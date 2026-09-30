const https = require('https');

const data = JSON.stringify({
  model: 'openai/gpt-oss-120b',
  messages: [
    {
      role: 'system',
      content: 'You extract insurance benefit facts for a VOB. Output JSON only: {"quality": {"classification": "human"}, "extractions": [{"field": "copay", "value": "$20", "status": "FOUND", "confidence": "high", "evidence": "copay is $20", "source": "payer_rep"}]}'
    },
    {
      role: 'user',
      content: 'Fields: copay, deductible, oop_max\nTranscript:\nRep: The copay is $20, individual deductible is $500, out of pocket max is $3000.'
    }
  ],
  response_format: { type: 'json_object' },
  reasoning_effort: 'high'
});

const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer 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',
    'Content-Type': 'application/json'
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const json = JSON.parse(body);
      console.log('Finish reason:', json.choices?.[0]?.finish_reason);
      console.log('Usage:', json.usage);
      console.log('Content:', json.choices?.[0]?.message?.content?.slice(0, 300));
      if (json.error) console.log('Error:', json.error);
    } catch (e) {
      console.log('Raw body:', body);
    }
  });
});
req.write(data);
req.end();
