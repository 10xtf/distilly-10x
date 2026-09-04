#!/usr/bin/env python3
"""
이메일 파서

지원 형식:
1. .eml 파일 (표준 메일 형식)
2. .txt 파일 (평문 메일 기록)
3. .mbox 파일 (여러 메일 묶음)

사용법:
    python email_parser.py --file emails.eml --target "hong@company.com" --output output.txt
    python email_parser.py --file inbox.mbox --target "홍길동" --output output.txt
"""

import email
import email.policy
import mailbox
import re
import sys
import argparse
from pathlib import Path
from email.header import decode_header
from html.parser import HTMLParser


class HTMLTextExtractor(HTMLParser):
    """HTML 메일 본문에서 평문을 추출한다."""

    def __init__(self):
        super().__init__()
        self.result = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = False
        if tag in ("p", "br", "div", "tr"):
            self.result.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.result.append(data)

    def get_text(self):
        return re.sub(r"\n{3,}", "\n\n", "".join(self.result)).strip()


def decode_mime_str(s: str) -> str:
    """MIME 인코딩된 메일 헤더 필드를 디코딩한다."""
    if not s:
        return ""
    parts = decode_header(s)
    result = []
    for part, charset in parts:
        if isinstance(part, bytes):
            charset = charset or "utf-8"
            try:
                result.append(part.decode(charset, errors="replace"))
            except Exception:
                result.append(part.decode("utf-8", errors="replace"))
        else:
            result.append(str(part))
    return "".join(result)


def extract_email_body(msg) -> str:
    """메일 객체에서 본문 텍스트를 추출한다."""
    body = ""

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in disposition:
                continue

            if content_type == "text/plain":
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                try:
                    body = payload.decode(charset, errors="replace")
                    break
                except Exception:
                    body = payload.decode("utf-8", errors="replace")
                    break

            elif content_type == "text/html" and not body:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                try:
                    html = payload.decode(charset, errors="replace")
                except Exception:
                    html = payload.decode("utf-8", errors="replace")
                extractor = HTMLTextExtractor()
                extractor.feed(html)
                body = extractor.get_text()
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            try:
                body = payload.decode(charset, errors="replace")
            except Exception:
                body = payload.decode("utf-8", errors="replace")

    # 인용문 정리 (Re: 회신 시 딸려오는 원문 인용)
    body = re.sub(r"\n>.*", "", body)
    body = re.sub(r"\n-{3,}.*?(원본 메시지|원본 메일|Original Message).*?\n", "\n", body, flags=re.DOTALL)
    body = re.sub(r"\n_{3,}\n.*", "", body, flags=re.DOTALL)

    return body.strip()


def is_from_target(from_field: str, target: str) -> bool:
    """메일이 대상 인물이 보낸 것인지 판정한다."""
    from_str = decode_mime_str(from_field).lower()
    target_lower = target.lower()
    return target_lower in from_str


def parse_eml_file(file_path: str, target: str) -> list[dict]:
    """.eml 파일 하나를 파싱한다."""
    with open(file_path, "rb") as f:
        msg = email.message_from_binary_file(f, policy=email.policy.default)

    from_field = str(msg.get("From", ""))
    if not is_from_target(from_field, target):
        return []

    subject = decode_mime_str(str(msg.get("Subject", "")))
    date = str(msg.get("Date", ""))
    body = extract_email_body(msg)

    if not body:
        return []

    return [{
        "from": decode_mime_str(from_field),
        "subject": subject,
        "date": date,
        "body": body,
    }]


def parse_mbox_file(file_path: str, target: str) -> list[dict]:
    """.mbox 파일(여러 메일 묶음)을 파싱한다."""
    results = []
    mbox = mailbox.mbox(file_path)

    for msg in mbox:
        from_field = str(msg.get("From", ""))
        if not is_from_target(from_field, target):
            continue

        subject = decode_mime_str(str(msg.get("Subject", "")))
        date = str(msg.get("Date", ""))
        body = extract_email_body(msg)

        if not body:
            continue

        results.append({
            "from": decode_mime_str(from_field),
            "subject": subject,
            "date": date,
            "body": body,
        })

    return results


def parse_txt_file(file_path: str, target: str) -> list[dict]:
    """
    평문 형식의 메일 기록을 파싱한다.
    다음과 같은 단순 구분 형식을 지원한다:
    From: xxx
    Subject: xxx
    Date: xxx
    ---
    본문 내용
    ===
    """
    results = []

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 구분자 기준으로 여러 메일을 분리 시도
    emails_raw = re.split(r"\n={3,}\n|\n-{3,}\n(?=From:)", content)

    for raw in emails_raw:
        from_match = re.search(r"^From:\s*(.+)$", raw, re.MULTILINE)
        subject_match = re.search(r"^Subject:\s*(.+)$", raw, re.MULTILINE)
        date_match = re.search(r"^Date:\s*(.+)$", raw, re.MULTILINE)

        from_field = from_match.group(1).strip() if from_match else ""
        if not is_from_target(from_field, target):
            continue

        # 본문 추출 (헤더 필드를 제거한 나머지)
        body = re.sub(r"^(From|To|Subject|Date|CC|BCC):.*\n?", "", raw, flags=re.MULTILINE)
        body = body.strip()

        if not body:
            continue

        results.append({
            "from": from_field,
            "subject": subject_match.group(1).strip() if subject_match else "",
            "date": date_match.group(1).strip() if date_match else "",
            "body": body,
        })

    return results


def classify_emails(emails: list[dict]) -> dict:
    """
    메일을 내용 기준으로 분류한다:
    - 긴 메일 (본문 200자 초과): 기술 방안, 관점 진술
    - 의사결정: 명확한 판단이 담긴 메일
    - 일상 소통: 짧은 메일
    """
    long_emails = []
    decision_emails = []
    daily_emails = []

    decision_keywords = [
        "동의", "반대", "제안", "방안", "생각", "해야", "결정", "확인",
        "approve", "reject", "lgtm", "suggest", "recommend", "think",
        "제 의견", "판단", "필요", "필수", "불필요", "권장",
    ]

    for e in emails:
        body = e["body"]

        if len(body) > 200:
            long_emails.append(e)
        elif any(kw in body.lower() for kw in decision_keywords):
            decision_emails.append(e)
        else:
            daily_emails.append(e)

    return {
        "long_emails": long_emails,
        "decision_emails": decision_emails,
        "daily_emails": daily_emails,
        "total_count": len(emails),
    }


def format_output(target: str, classified: dict) -> str:
    """AI 분석에 쓸 수 있도록 서식화해 출력한다."""
    lines = [
        f"# 메일 추출 결과",
        f"대상 인물: {target}",
        f"전체 메일 수: {classified['total_count']}",
        "",
        "---",
        "",
        "## 긴 메일 (기술 방안/관점, 가중치 최상)",
        "",
    ]

    for e in classified["long_emails"]:
        lines.append(f"**제목: {e['subject']}** [{e['date']}]")
        lines.append(e["body"])
        lines.append("")
        lines.append("---")
        lines.append("")

    lines += [
        "## 의사결정 메일",
        "",
    ]

    for e in classified["decision_emails"]:
        lines.append(f"**제목: {e['subject']}** [{e['date']}]")
        lines.append(e["body"])
        lines.append("")

    lines += [
        "---",
        "",
        "## 일상 소통 (문체 참고용)",
        "",
    ]

    for e in classified["daily_emails"][:30]:
        lines.append(f"**{e['subject']}**：{e['body'][:200]}")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="메일 파일을 파싱해 대상 인물이 보낸 메일을 추출한다")
    parser.add_argument("--file", required=True, help="입력 파일 경로 (.eml / .mbox / .txt)")
    parser.add_argument("--target", required=True, help="대상 인물 (이메일 주소 또는 이름)")
    parser.add_argument("--output", default=None, help="출력 파일 경로 (기본값: stdout 출력)")

    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"오류: 파일이 없습니다 {file_path}", file=sys.stderr)
        sys.exit(1)

    suffix = file_path.suffix.lower()

    if suffix == ".eml":
        emails = parse_eml_file(str(file_path), args.target)
    elif suffix == ".mbox":
        emails = parse_mbox_file(str(file_path), args.target)
    else:
        emails = parse_txt_file(str(file_path), args.target)

    if not emails:
        print(f"경고: '{args.target}' 이(가) 보낸 메일을 찾지 못했습니다", file=sys.stderr)
        print("힌트: 대상 이름/이메일이 파일의 From 필드와 일치하는지 확인하세요", file=sys.stderr)

    classified = classify_emails(emails)
    output = format_output(args.target, classified)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"{args.output} 에 출력했습니다. 총 {len(emails)}건")
    else:
        print(output)


if __name__ == "__main__":
    main()
