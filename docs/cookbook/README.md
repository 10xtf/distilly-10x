# Cookbook

This folder contains executable procedures for behavior that is already shipped. Every cookbook names a real entry point and ends with a verification command that fails when the procedure is broken.

There are no Distilly product cookbooks yet because `SourceAdapter`, `HostInjector`, and `Person` are target contracts, not current APIs. Read [design/v2/13-source-adapters.md](../design/v2/13-source-adapters.md) and [design/v2/14-host-injection.md](../design/v2/14-host-injection.md) for their design. Add a cookbook in the same change that ships the corresponding entry point and test.

Repository administrators use [protecting-governed-branches.md](protecting-governed-branches.md) to turn CI detection into a required GitHub gate.
