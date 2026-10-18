// Risposte finte dell'API Messages in streaming (SSE), condivise da unit test ed e2e.

export function sseBody(text, { stopReason = 'end_turn', model = 'claude-opus-5-5' } = {}) {
  const events = [
    [
      'message_start',
      {
        type: 'message_start',
        message: {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 0 },
        },
      },
    ],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    [
      'message_delta',
      { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 10 } },
    ],
    ['message_stop', { type: 'message_stop' }],
  ];
  return events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
}

// Traduzione finta: "[it] " davanti a ogni testo, tag e segmenti invariati.
export function fakeReply(requestBody, prefix = '[it] ') {
  const content = requestBody.messages[0].content;
  return content.replace(/<s i="(\d+)">([\s\S]*?)<\/s>/g, (_, i, seg) => `<s i="${i}">${prefix}${seg}</s>`);
}
