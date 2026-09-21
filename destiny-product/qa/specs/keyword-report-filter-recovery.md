# Keyword report filter recovery

A successful new keyword/domain report must show its returned rows using cleared text and intent filters. The failure case must retain the prior report and its filters so an unsuccessful request does not silently alter the old view. All research entrypoints share requestResearch. Sorting preferences and saved/list/site state remain intact; provider measurements are never copied to a different phrase.

Browser acceptance uses explicit synthetic provider responses: filter a background-check report by text and commercial intent, search an informational ChatGPT report, verify cleared controls and visible measured row; repeat through domain mode. A failed request retains the previous report, text/intent and visible result. Real-provider numerical accuracy and exact-phrase fallback are separate acceptance items.

Related suggestions use the same successful-reset contract and are included in desktop/mobile tests. RED3fail/1pass on byte-identical baseline component; production GREEN8/8. No metric/provider or persistence API modifications.
