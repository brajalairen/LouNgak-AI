# Future extension: conversation follow-ups and voice

**Status: not implemented.** LouNgak AI answers one question at a time. This note keeps the design and the
integration point for adding conversation (follow-up questions) and hands-free voice later. Nothing here is wired
into the application, and the application needs none of it.

## Background

A first implementation was built and then removed from the product (commit `56d8c3f`), because:

- Hands-free voice picked up its own spoken answers through the speakers, an audio feedback loop that the
  interruption logic did not fully contain.
- In testing, one answer appeared twice: in the conversation panel and as the normal answer card.
- Voice depended on the browser's Web Speech API: Chrome and Edge only, English only, and in Chrome the audio is
  processed by Google's servers.

The complete removed implementation is preserved under the Git tag `archive/conversation-voice` (and in commit
`0d8a023`). Read it with, for example, `git show archive/conversation-voice:satquery/agri/conversation.py`. Use it
as reference only; do not restore it wholesale.

## Principles

1. **Conversation adds nothing to answering.** A follow-up such as *Why?* or *What about Thoubal?* is only rewritten
   into a complete question (*Why is Thoubal flagged?*), which is then asked through the existing `POST /api/route`
   and `POST /api/agri/query` exactly as if it had been typed. Routing, the risk engine, the answer text, every
   figure and every PLACEHOLDER/SAMPLE warning stay those of the existing system.
2. **Stateless server.** The server keeps no conversation. The client sends back what the previous answer was about
   with each message.
3. **Rule-based, no language model,** like the rest of the router.
4. **Clarify, never guess.** A follow-up that cannot be tied to one area gets a clarifying question back and is
   never sent on to satellite analysis.
5. **Voice is a client-side layer** over the same pipeline, never a separate path to answers.
6. **Optional.** The application must keep working without it: no new required dependencies or services.

## Integration point (interface contract)

One new endpoint, mounted next to the agricultural router in `satquery/server.py` (`create_app`):

```
POST /api/chat/resolve
request:  { "message": str (1-2000 chars), "context": ChatContext }
response: ChatResolveResult
```

```python
class ChatContext(BaseModel):          # what the previous answer was about, as the client read it
    last_query: str | None = None
    last_intent: str | None = None     # a key of satquery.agent.language.INTENTS, or "IMAGERY"
    focus_area_id: str | None = None
    area_ids: list[str] = []           # areas the last ranking or inspection list gave, in order
    language: str | None = None

class ChatResolveResult(BaseModel):
    query: str | None                  # the complete question to ask; None when a clarification is needed
    rewritten: bool                    # True when `query` differs from the message
    rule: str                          # how the message was read, shown to the user ("Read as: ...")
    clarification: str | None          # asked back instead of guessing
    area_id: str | None                # the area a follow-up was tied to
```

Both models must be mirrored in `web/src/state/types.ts` and added to the `MIRRORED` table in
`tests/test_contract.py`. The resolver needs only the monitored areas (`AssessmentService.areas()`) and the
existing helpers `satquery.agri.query.resolve_area` and `aliases` and `satquery.agent.language.normalize`.

### Follow-up rules (English, first version)

| Message | Read as | Without enough context |
|---|---|---|
| *Why?*, *Why is that?*, *Explain*, *Tell me more* | *Why is {focus area} flagged?* | Ask which area |
| *What about Thoubal?*, *And Kakching?* | The previous question's intent, about that area | Unknown or ambiguous name: list the monitored areas |
| *The second one*, *Number 3*, *The last one* | That position in the last list | No list yet, or position out of range: ask |
| *Is there pest risk there?* | *there* replaced by the focus area's name | Asked as it is |
| A weather or crop-health follow-up about a named area | Ask the user to draw the area | (needs a drawn area) |
| A complete question, or any Latin Manipuri question | Unchanged | — |

## Voice layer (client only)

If voice is added again, keep it a state machine around the conversation pipeline:

```
IDLE -> LISTENING -> PROCESSING (resolve + existing answer) -> SPEAKING -> LISTENING ...
SPEAKING -> user speech -> INTERRUPTING (speech cancelled, turn invalidated) -> LISTENING
```

Lessons from the first implementation, each fixing a failure seen in use:

- One continuous recognition session for the whole voice chat; never stop and start the microphone between phases.
- The app decides when the user has finished speaking (a short silence after their words), not the browser's first
  pause.
- Echo: remove the app's own words from what is heard before treating speech as an interruption, and require more
  than one word (or a stop word) to interrupt. Prefer real echo cancellation (headphones, or an audio pipeline with
  AEC) over text matching: this is where the first version failed.
- A turn counter: every asynchronous step carries the turn it started in and does nothing if it is stale.
- One cancellation path and one validated state-transition function.
- A watchdog for speech output that ends without an end event.
- The answer shown on screen is the same single answer card; do not render it twice.

Planned offline replacements for the browser services: Whisper (speech recognition) and Piper (speech output),
which would also remove the dependence on Chrome/Edge and on Google's servers.

## Acceptance criteria for a future implementation

- With the feature switched off or absent, the application and all existing tests behave exactly as without it.
- Resolver unit tests for every rule above, including each clarification case.
- A contract test for the two models.
- A manual check in a real browser with a real microphone and speakers (not only headless), including talking over
  the app's own answer.
- No change to routing rules, risk scoring, thresholds or answer text.
