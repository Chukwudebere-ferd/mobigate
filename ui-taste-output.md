# UI Taste by Uizze - Skill Output

**Command run:** `npx skills use "https://uizze.sh/" --skill "ui-taste"`

**Supporting files directory:** `C:\Users\ADMIN3~1\AppData\Local\Temp\skills-use-LE4qFP\ui-taste`

---

## Skill Overview

The **ui-taste** skill from Uizze helps coding agents build and polish web and iOS interfaces with better visual design. It provides structured playbooks for UI design, implementation, redesign, critique, and final visual review.

**Key metadata:**
- **Version:** 0.3.0
- **Author:** UIZZE <business@uizze.com>
- **License:** Apache-2.0
- **Compatibility:** Designed for Claude Code, Codex, Cursor, and GitHub Copilot; works in any agent that can read project files and fetch a URL
- **Tags:** ui-design, design-system, design-review, frontend, web-ui, ios-ui

---

## Core Workflow Principles

### 1. **Image First, Then Implement**
- Follow Uizze's image-to-UI workflow before visual implementation
- When authorized image-generation tools are available, start with a realistic UI image inspected before code
- An approved supplied image takes precedence - save actual dimensions and build 1:1 with semantic components
- Render at viewport once assets and fonts load, compare with stable target, correct visible mismatches

### 2. **Select the Right Workflow**
Load the playbook based on the requested action:

| Workflow | When to Use |
|----------|-------------|
| **new-work** | New interface or major redesign |
| **operate** | Product or dashboard work |
| **polish** | Refinement and polish of existing interface |
| **distill** | Simplification |
| **audit** | Explicit web audit (read-only unless fixes requested) |
| **iOS** | Native iOS interfaces |
| **overdrive** | "Uizze Overdrive" or exceptional interaction work |

### 3. **Work from the Product**
- Read the brief, existing UI, components, tokens, assets, and any PRODUCT.md or DESIGN.md
- Preserve established visual systems for extensions and polish
- Replace only for approved redesigns
- A new project does not require those files

### 4. **Identify Key Parameters**
- Audience, primary task, important states, intended result
- Ask only about missing choices that would materially change the work
- A precise request is enough; don't turn small fixes into discovery workshops

---

## Optional Uizze Evidence

### Reference Policy
- Read the reference policy before using `find_ui_references` or `find_ui_materials`
- Inspect relevant visual evidence when it can inform layout, state, interaction, or assets
- Distinguish exact reference, related example, no match, and service error
- Briefly disclose limitations that affected results
- Never claim an image was inspected or a state was found without evidence

### Uizze References and Materials
- Use Uizze for relevant examples, fonts, icons, or design systems
- Inspect actual returned references and apply structural lessons
- Do not copy another product's branding or screenshots into the interface
- Do not invent asset rights or resource access
- Connected Uizze resources require paid access and are optional

---

## Finish Guidelines

- Build the requested scope and exercise its important states
- Render and inspect at representative desktop/mobile sizes or native device classes
- Compare with chosen direction or supplied reference, not just absence of runtime errors
- Fix material problems in a batch, then render and inspect again
- Stop once the requested result is verified; don't keep inventing work
- If a bounded pass cannot resolve an issue, report it instead of claiming a pass
- When rendering is unavailable, distinguish code checks from visual verification

**Handoff:** Keep concise - what changed, what was actually tested, and any remaining limitation.

A skill does not authorize publishing, purchases, new dependencies, account changes, or destructive actions.

---

## Supporting Files Directory Structure

The skill downloaded supporting files to:
```
C:\Users\ADMIN3~1\AppData\Local\Temp\skills-use-LE4qFP\ui-taste\
```

### Directory Contents:

**reference/** - Individual playbook files:
- `audit.md` - Web audit playbook (8,991 bytes)
- `audit.native.md` - Native audit playbook (11,518 bytes)
- `craft.md` - Implementation craft guidance (9,049 bytes)
- `distill.md` - Simplification playbook (1,103 bytes)
- `ios.md` - Native iOS guidance (4,636 bytes)
- `new-work.md` - New interface/redesign playbook (15,468 bytes)
- `operate.md` - Product/dashboard work playbook (3,921 bytes)
- `overdrive.md` - Exceptional interaction work (11,180 bytes)
- `polish.md` - Polish/refine existing interface (8,903 bytes)

**references/** - Reference policy files:
- `uizze-image-to-ui.md` - Image-first → 1:1 UI workflow (10,414 bytes)
- `uizze-reference-policy.md` - Reference policy (2,233 bytes)

**agents/** - Agent configuration:
- `openai.yaml` - OpenAI agent configuration (239 bytes)

**MANIFEST.json** - Package manifest (10,766 bytes)
**MODIFICATIONS.md** - Modifications documentation (2,606 bytes)
**NOTICE** - Third-party attribution (1,909 bytes)
**LICENSE** - Apache-2.0 license (10,766 bytes)
**CHECKSUMS.sha256** - SHA256 checksums (1,453 bytes)

---

## Key Directives from the Skill

### **Never do these things:**
- Turn a small fix into a discovery workshop
- Claim an image was inspected or a state was found without evidence
- Fabricate a generated target or call an implementation 1:1 when there is no real comparison image
- Invent customers, prices, metrics, endpoints, or product capabilities
- Copy another product's branding or screenshots into the interface
- Invent asset rights or resource access
- Claim 1:1 fidelity without a real target and inspected same-size render
- Claim release readiness, accessibility conformance, or a complete device matrix from source inspection alone
- Keep looping indefinitely on cosmetic fixes
- Claim visual pass or release-readiness when visual match is unverified

### **Always do these things:**
- Distinguish exact reference, related example, no match, and service error
- Disclose limitations that affected results
- Report the target used and its actual dimensions
- Make one coherent correction pass, then run and inspect again
- Recheck changed states and representative supported sizes, themes, zoom/text scaling, focus, semantics, and accessible names
- Keep the handoff concise: what changed, what was actually tested, and any remaining limitation

---

## Common Use Cases

This skill is useful for:

1. **New interface design** - Starting from scratch with proper visual direction
2. **Interface polish** - Refining existing UIs while preserving the visual language
3. **Redesign reviews** - Evaluating whether a redesign is warranted or if refinement suffices
4. **Design system audits** - Checking for drift, missing tokens, and conceptual mismatches
5. **iOS native audits** - Ensuring native platform conventions are followed
6. **Overdrive work** - Exceptional interaction design when requested

---

## Installation (if needed)

As a free skill, no installation is required - it works via `npx skills use`. The optional full UIZZE MCP may require separate access and authentication.

**Note:** The free skill and public catalogue work without an account, token, MCP connection, dependency, script, or executable.