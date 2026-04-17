async function calculateFraudScore(application, existingRecords, requestMeta) {
  let score = 0;
  const reasons = [];

  // 1. Duplicate Aadhaar — same scheme
  const dupAadhaarSameScheme = existingRecords.filter(r =>
    r.aadhaar_no === application.aadhaar_no &&
    r.scheme === application.scheme
  );
  if (dupAadhaarSameScheme.length > 0) {
    score += 35;
    reasons.push(`Aadhaar already registered under ${application.scheme} scheme`);
  }

  // 2. Cross-scheme fraud — same Aadhaar, different scheme
  const dupAadhaarCrossScheme = existingRecords.filter(r =>
    r.aadhaar_no === application.aadhaar_no &&
    r.scheme !== application.scheme
  );
  if (dupAadhaarCrossScheme.length > 0) {
    score += 25;
    reasons.push(`Aadhaar already used in ${dupAadhaarCrossScheme.map(r => r.scheme).join(", ")} scheme(s)`);
  }

  // 3. PAN linked to different Aadhaar
  const panMismatch = existingRecords.filter(r =>
    r.pan_no === application.pan_no &&
    r.aadhaar_no !== application.aadhaar_no
  );
  if (panMismatch.length > 0) {
    score += 30;
    reasons.push("PAN card is linked to a different Aadhaar number — identity mismatch");
  }

  // 4. Same mobile across different identities
  const mobileDup = existingRecords.filter(r =>
    r.phone === application.phone &&
    r.aadhaar_no !== application.aadhaar_no
  );
  if (mobileDup.length > 0) {
    score += 20;
    reasons.push(`Mobile number linked to ${mobileDup.length} other Aadhaar(s)`);
  }

  // 5. IP velocity — too many submissions from same IP
  const ipCount = existingRecords.filter(r => r.ipAddress === requestMeta.ip).length;
  if (ipCount >= 3) {
    score += 20;
    reasons.push(`${ipCount} applications submitted from the same IP address`);
  }

  // 6. Suspicious submission time (2AM - 5AM)
  const hour = new Date().getHours();
  if (hour >= 2 && hour <= 5) {
    score += 15;
    reasons.push("Application submitted during suspicious hours (2AM–5AM), possible automated bot");
  }

  // 7. Bot detection — form filled too fast
  if (requestMeta.fillTimeSeconds && requestMeta.fillTimeSeconds < 25) {
    score += 20;
    reasons.push(`Form completed in only ${requestMeta.fillTimeSeconds} seconds — possible bot submission`);
  }

  // 8. Sequential/fake Aadhaar pattern
  const digits = application.aadhaar_no?.replace(/\s/g, "") || "";
  const isFakePattern = /^(\d)\1{11}$/.test(digits) || digits === "123456789012";
  if (isFakePattern) {
    score += 25;
    reasons.push("Aadhaar number has a suspicious repeating or sequential pattern");
  }

  // 9. Syndicate detection — same phone + IP cluster
  const syndicateMatch = existingRecords.filter(r =>
    r.ipAddress === requestMeta.ip && r.phone === application.phone &&
    r.aadhaar_no !== application.aadhaar_no
  );
  if (syndicateMatch.length >= 2) {
    score += 30;
    reasons.push("Multiple different identities share same IP and phone — possible fraud syndicate");
  }

  const finalScore = Math.min(score, 100);
  const verdict =
    finalScore >= 60 ? "HIGH RISK" :
    finalScore >= 30 ? "MEDIUM RISK" : "LOW RISK";

  return { score: finalScore, verdict, reasons };
}

module.exports = { calculateFraudScore };