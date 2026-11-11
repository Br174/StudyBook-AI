# StudyBook AI LAB120 — obiettivi CENTRALI e fasce di accettazione PRIVATE

Data 2026-11-11. MotorLab CORE e satellite r40 verificati. User instruction: Gemini must NOT see the widened tolerance bands. They are exclusively an application's post-generation acceptance policy. Prefer the CENTER at all times, and only pass content after genuine semantic verification.

## Five requested new bands (reduction of alphabetic original letters)
| Requested stage | Ideal target that the MODEL may see | PRIVATE acceptance band that the MODEL must NOT see |
| 10 | 15% | 10–20% |
| 20 | 25% | 20–30% |
| 30 | 35% | 30–40% |
| 40 | 45% | 40–50% |
| Riassunto (summary) | 55% | 50–60% |

The real source text and target-letter count remain authoritative. Never relabel an incorrect draft, delete meaningful content, add filler, or pass a numerical result in lieu of semantic correctness. Every page's full source and virtual row geometry must be verified before a result is accepted.

The old installed StudyBook app has SIX levels (summary, 50, 40, 30, 20, 10), whereas this user instruction specifies FIVE bands. LAB120 deliberately DOES NOT delete the existing standalone 50% edition, and it does not silently assign it a new range. The installed app and all its saved data remain unchanged; future integration must reconcile that additional existing level without destructive changes.

## Code investigation
The existing src/lib/studyLeanPercentV111.js includes explicit ±5 and per-page minimum / maximum in Gemini instructions. The Worker api/editionsBulkV51.js sends minLetters and maxLetters in relevant model content. Therefore just widening post-generation validators is insufficient for this specific user requirement. The acceptance tolerance must be isolated end-to-end from all model-visible prompt components.

## Implemented as a research-only contract
- src/lib/studyPrivateAcceptanceV120.js: independent local-only policy for the five explicitly requested stages.
- geminiStrictBriefV120 and providerTargetV120: model-facing content contains exact target centers and target retained letters ONLY. No private min / max.
- privateBandV120, privateReviewV120: strict integer ORIGINAL LETTER counting and closed band acceptance; ideal center remains the optimization target.
- A result passes ONLY if the numerical band, verified semantics, verified row layout and full original source all pass.
- assertPrivateNotLeakedV120 rejects protected private-tolerance fields/phrases from a hypothetical model payload.

## Tests / source
GitHub Actions https://github.com/Br174/StudyBook-AI/actions/runs/42999792854 SUCCESS, 93 checks, no Gemini requests, no paid services, no private PDF. Tested both inclusive bounds and 0.1 percentage point outside bounds, center precision, absence of tolerance in provider payload, false semantic/row approval rejection and missing page rejection. An earlier red run 42999704352 was a test typo (sourceComplete versus actual completeSource), fixed before successful run.

## Safety / release
LAB120 NOT integrated into Android app, Worker, nor live 6-level generator. No APK or ZIP compiled. The user’s saved books and checkpoint remain untouched. No LAST_GOOD promotion. Further model-real tests and full end-to-end integration are pending. ZERO additional paid cost.
