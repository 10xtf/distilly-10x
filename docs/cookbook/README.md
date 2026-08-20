# Cookbook

This folder contains executable procedures for behavior that is already shipped. Every cookbook names a real entry point and ends with a verification command that fails when the procedure is broken.

There are no Distilly product cookbooks yet because `SourceAdapter`, `HostInjector`, and `Person` are target contracts, not current APIs. Read [research/adapters](../design/v3/10-research-provenance.md), [Recall/injection](../design/v3/16-recall-and-injection.md), and the [public SDK](../design/v3/18-public-sdk.md) for their design. Add a cookbook in the same change that ships the corresponding entry point and test.

Repository administrators use [protecting-governed-branches.md](protecting-governed-branches.md) to turn CI detection into a required GitHub gate.
