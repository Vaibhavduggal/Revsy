import { detectSentimentReply, isNoComplaintReply, extractInboundMessages } from './src/sentimentFlow.js';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
  console.log('ok -', msg);
}

assert(detectSentimentReply('😊') === 'positive', 'happy emoji');
assert(detectSentimentReply('1') === 'positive', 'reply 1');
assert(detectSentimentReply('😞') === 'negative', 'sad emoji');
assert(detectSentimentReply('2') === 'negative', 'reply 2');
assert(detectSentimentReply('not great') === 'negative', 'not great');
assert(detectSentimentReply('hello there') === null, 'ambiguous text');
assert(isNoComplaintReply("nothing, you're awesome") === true, 'nothing youre awesome');
assert(isNoComplaintReply('Nothing') === true, 'nothing');
assert(isNoComplaintReply('Please add more squat racks near the window') === false, 'real suggestion');

const parsed = extractInboundMessages({
  entry: [{ changes: [{ value: { messages: [{ from: '919988777999', text: { body: '😊' } }] } }] }],
});
assert(parsed.length === 1 && parsed[0].text === '😊' && parsed[0].phone.endsWith('9988777999'), 'meta webhook parse');

const aisensy = extractInboundMessages({ mobile: '919811110001', text: 'Please add more squat racks' });
assert(aisensy[0].text.includes('squat'), 'aisensy parse');

console.log('sentimentFlow unit tests passed');
