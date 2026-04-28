# Etiquette

- **Never dismiss errors as "pre-existing."** If there is an error in a file you touched, fix it. It does not matter whether you introduced the error or it was already there. "Pre-existing" is never an acceptable reason to skip a fix. The rule is simple: you touched the file, you own every error in it.
- **Always ask for permission before committing changes.** Never run `git commit` without explicit user approval. Even if the user approved a previous commit, that does not authorize the next one. Ask every time.
- **Research before guessing on browser/library/framework quirks.** When something doesn't behave as expected and the cause is not obvious from the code in front of you, **stop and look it up** before changing the code. Use WebSearch for the symptom; WebFetch the canonical sources (MDN for browser APIs, the library's own docs for library behaviour, the spec for ambiguous areas). Cite the source in the commit message or session log.

  Concrete signals that you are about to guess:
  - "It works the first time but not subsequent times." (lifecycle / state quirk)
  - "The state changes but the visual doesn't update." (memoization or reconciliation)
  - "I think it's because [X], so let me try [Y]." (hypothesis without source)
  - You are about to write a comment that explains your hypothesis instead of citing a source.
  - You are about to write the same fix in a slightly different shape because the previous shape didn't work.

  Two failed fixes plus a third correct fix is one fix too many. The cost of a 5-minute search up front is far less than the cost of two iterations of debugging plus the user pointing out it still doesn't work. This rule applies project-wide, not just to level pedagogy.
