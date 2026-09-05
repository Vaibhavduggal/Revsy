import { detectSentimentReply, isNoComplaintReply, extractInboundMessages, extractDeliveryStatuses, shouldAdvanceDelivery } from './src/sentimentFlow.js';

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

const metaStatus = extractDeliveryStatuses({
  entry: [{ changes: [{ value: { statuses: [{ recipient_id: '919988777999', status: 'delivered' }] } }] }],
});
assert(metaStatus.length === 1 && metaStatus[0].status === 'delivered', 'meta delivery status');

const aisensyStatus = extractDeliveryStatuses({ mobile: '919811110001', status: 'read' });
assert(aisensyStatus[0].status === 'read', 'aisensy read receipt');

assert(shouldAdvanceDelivery('sent', 'read') === true, 'advance sent to read');
assert(shouldAdvanceDelivery('read', 'sent') === false, 'do not regress read to sent');
assert(shouldAdvanceDelivery('sent', 'failed') === true, 'failed after sent');

console.log('sentimentFlow unit tests passed');
