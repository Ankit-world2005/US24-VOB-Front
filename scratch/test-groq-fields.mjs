import https from 'node:https';

const fields = [
  "copay", "deductible_individual", "deductible_met", "deductible_remaining",
  "coinsurance", "out_of_pocket", "oop_met", "oop_remaining",
  "network_status", "authorization_required", "referral_required"
];

const prompt = `Source: phone call

Fields (key | label | type):
${fields.map(f => `- ${f} | ${f} | string`).join('\n')}

<transcript>
Specialist: Hi, calling for physical therapy benefits for patient John Doe.
Rep: Sure. Network status is in-network. Copay is $30 for physical therapy. Deductible is $1000 individual, $250 met, $750 remaining. Out of pocket max is $4000, $500 met, $3500 remaining. Coinsurance is 20%. No prior authorization is required for evaluation, but treatment requires authorization. Referral is not required.
</transcript>`;

async function callGroq(effort) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: 'You extract insurance benefit facts for a VOB. Output JSON only: {"quality": {"classification": "human"}, "extractions": [{"field": "key", "value": "val", "status": "FOUND", "confidence": "high", "evidence": "quote", "source": "payer_rep"}]}'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: effort
    });

    const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({
            effort,
            finish_reason: json.choices?.[0]?.finish_reason,
            usage: json.usage,
            error: json.error
          });
        } catch (e) {
          reject(body);
        }
      });
    });
    req.write(data);
    req.end();
  });
}

const highRes = await callGroq('high');
console.log('HIGH:', highRes);

const lowRes = await callGroq('low');
console.log('LOW:', lowRes);
