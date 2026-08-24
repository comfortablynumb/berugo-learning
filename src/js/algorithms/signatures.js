/**
 * ECDSA, deterministic nonces, and the bug that emptied wallets.
 *
 * ⚠ TEACHING CODE. Toy curve, not constant-time, not audited, never for real
 * data.
 *
 * A signature and a MAC answer different questions. A MAC says "someone holding
 * the shared key produced this", which both parties can do, so it proves
 * nothing to a third party. A signature says "the holder of THIS private key
 * produced this", which is verifiable by anyone and cannot be produced by the
 * verifier — that asymmetry is what makes certificates and non-repudiation
 * possible.
 *
 * ECDSA's failure mode is famous and entirely avoidable. Every signature uses a
 * per-message secret k, and two signatures made with the same k over different
 * messages give two linear equations in two unknowns — k and the private key.
 * Solving takes three modular operations. That bug broke the PlayStation 3's
 * code-signing and drained Bitcoin wallets whose wallet software had a weak
 * RNG. RFC 6979 removes the whole class by deriving k deterministically from
 * the key and the message, and EdDSA bakes that in.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Signatures = api;
}(this, function (root) {
  'use strict';

  const Pk = root && root.PublicKey ? root.PublicKey : require('./public-key.js');
  const Hash = root && root.CryptoHash ? root.CryptoHash : require('./crypto-hash.js');

  const DISCLAIMER = 'Teaching implementation: toy curve, not constant-time, never for real data.';

  function toBig(bytes) {
    let value = 0n;

    bytes.forEach(function (byte) { value = (value << 8n) | BigInt(byte); });
    return value;
  }

  /** The message hash, reduced into the group order — which is what ECDSA
   *  signs, and why a longer hash than the curve buys nothing. */
  function messageValue(message, curve) {
    return toBig(Hash.sha256(message)) % curve.n;
  }

  /* -------------------------------------------------------------- ECDSA */

  function keyPair(privateKey, curve) {
    return { d: privateKey % curve.n, q: Pk.scalarMul(privateKey % curve.n, curve.g, curve) };
  }

  /**
   * Sign with an explicitly supplied k, so the demo can supply the SAME k twice
   * and the attack becomes executable rather than described. A real signer
   * derives k deterministically; `deterministicNonce` below does that.
   */
  function sign(config) {
    const curve = config.curve;
    const z = messageValue(config.message, curve);
    const point = Pk.scalarMul(config.k % curve.n, curve.g, curve);
    const r = point.infinity ? 0n : point.x % curve.n;
    const kInverse = Pk.modInverse(config.k % curve.n, curve.n);
    const s = (kInverse * (z + r * config.key.d)) % curve.n;

    return { r: r, s: s, z: z, k: config.k % curve.n };
  }

  function verify(config) {
    const curve = config.curve;
    const z = messageValue(config.message, curve);
    const signature = config.signature;

    if (signature.r <= 0n || signature.r >= curve.n) return false;
    if (signature.s <= 0n || signature.s >= curve.n) return false;
    const w = Pk.modInverse(signature.s, curve.n);
    const u1 = (z * w) % curve.n;
    const u2 = (signature.r * w) % curve.n;
    const point = Pk.pointAdd(Pk.scalarMul(u1, curve.g, curve),
      Pk.scalarMul(u2, config.publicKey, curve), curve);

    if (point.infinity) return false;
    return point.x % curve.n === signature.r;
  }

  /**
   * RFC 6979's idea, simplified: derive k from the private key and the message
   * with HMAC, so it is unpredictable to everyone else and identical for the
   * same input. It removes the entire class of RNG failures — you cannot repeat
   * a nonce on two different messages if the nonce is a function of the message.
   */
  function deterministicNonce(config) {
    const curve = config.curve;
    const keyBytes = [];
    let d = config.key.d;

    while (d > 0n) {
      keyBytes.unshift(Number(d & 0xffn));
      d >>= 8n;
    }
    const mac = Hash.hmac('sha-256', keyBytes, Hash.sha256(config.message));
    const k = toBig(mac) % (curve.n - 1n);

    return k === 0n ? 1n : k;
  }

  /* --------------------------------------------- the nonce-reuse recovery */

  /**
   * Two signatures with one k. Subtracting the two s-equations eliminates the
   * private key and leaves k; substituting back gives d. Three modular
   * operations, no search, and the private key is on the screen.
   */
  function recoverFromReusedNonce(config) {
    const n = config.curve.n;
    const first = config.first;
    const second = config.second;
    const numerator = ((first.z - second.z) % n + n) % n;
    const denominator = ((first.s - second.s) % n + n) % n;
    const k = (numerator * Pk.modInverse(denominator, n)) % n;
    const d = (((first.s * k - first.z) % n + n) % n * Pk.modInverse(first.r, n)) % n;

    return { k: k, d: d, sharedR: first.r === second.r };
  }

  /* ---------------------------------------------------- certificate chains */

  /**
   * A certificate, reduced to the fields a validator actually checks. Real
   * X.509 has dozens more and most CVEs in this area are a validator that
   * skipped one of these five.
   */
  function certificate(config) {
    return {
      subject: config.subject,
      issuer: config.issuer,
      notBefore: config.notBefore,
      notAfter: config.notAfter,
      isCa: config.isCa === true,
      pathLength: config.pathLength === undefined ? 0 : config.pathLength,
      keyUsage: config.keyUsage || (config.isCa ? ['certSign'] : ['digitalSignature']),
      names: config.names || [config.subject],
      key: config.key,
      signature: config.signature || null
    };
  }

  function signCertificate(cert, issuerKey, curve) {
    const body = certificateBody(cert);

    return Object.assign({}, cert, {
      signature: sign({ curve: curve, key: issuerKey,
        k: deterministicNonce({ curve: curve, key: issuerKey, message: body }),
        message: body })
    });
  }

  function certificateBody(cert) {
    return Hash.bytesOf([cert.subject, cert.issuer, cert.notBefore, cert.notAfter,
      cert.isCa ? 'ca' : 'leaf', cert.pathLength, cert.keyUsage.join('+'),
      cert.names.join(','), String(cert.key.q.x) + ':' + String(cert.key.q.y)].join('|'));
  }

  /**
   * Chain validation, one check per step, each returning its own verdict so a
   * failure names the check that failed rather than "invalid certificate".
   * Every one of these has been the subject of a real CVE.
   */
  function validateChain(config) {
    const chain = config.chain;
    const checks = [];
    const at = config.at;

    chain.forEach(function (cert, i) {
      const issuer = chain[i + 1] || config.trustAnchor;

      checks.push(signatureCheck(cert, issuer, config.curve));
      checks.push({ name: 'validity window for ' + cert.subject,
        ok: at >= cert.notBefore && at <= cert.notAfter,
        detail: cert.notBefore + ' to ' + cert.notAfter + ', checked at ' + at });
      if (i > 0) {
        checks.push({ name: 'basic constraints: ' + cert.subject + ' may sign',
          ok: cert.isCa === true,
          detail: cert.isCa ? 'CA:TRUE' : 'CA:FALSE — a leaf must not sign another certificate' });
        checks.push({ name: 'key usage: ' + cert.subject + ' has certSign',
          ok: cert.keyUsage.indexOf('certSign') !== -1,
          detail: cert.keyUsage.join(', ') });
      }
      checks.push({ name: 'issuer of ' + cert.subject + ' matches subject above',
        ok: !!issuer && cert.issuer === issuer.subject,
        detail: cert.issuer + ' against ' + (issuer ? issuer.subject : 'nothing') });
    });
    checks.push(nameCheck(chain[0], config.host));
    return {
      checks: checks,
      valid: checks.every(function (check) { return check.ok; }),
      failed: checks.filter(function (check) { return !check.ok; })
    };
  }

  function signatureCheck(cert, issuer, curve) {
    if (!issuer || !cert.signature) {
      return { name: 'signature on ' + cert.subject, ok: false, detail: 'no issuer or no signature' };
    }
    const ok = verify({ curve: curve, publicKey: issuer.key.q,
      signature: cert.signature, message: certificateBody(cert) });

    return { name: 'signature on ' + cert.subject + ' by ' + issuer.subject, ok: ok,
      detail: ok ? 'verifies against the issuer key' : 'does NOT verify' };
  }

  /** Name matching, with the wildcard rule that matches one label and not a
   *  dot — the distinction several validators have got wrong. */
  function nameCheck(leaf, host) {
    const matched = leaf.names.some(function (name) { return matchesName(name, host); });

    return { name: 'host name ' + host + ' matches the leaf', ok: matched,
      detail: leaf.names.join(', ') };
  }

  function matchesName(pattern, host) {
    if (pattern === host) return true;
    if (pattern.indexOf('*.') !== 0) return false;
    const suffix = pattern.slice(1);

    if (host.length <= suffix.length) return false;
    if (host.slice(host.length - suffix.length) !== suffix) return false;
    return host.slice(0, host.length - suffix.length).indexOf('.') === -1;
  }

  return {
    DISCLAIMER: DISCLAIMER,
    toBig: toBig, messageValue: messageValue, keyPair: keyPair,
    sign: sign, verify: verify, deterministicNonce: deterministicNonce,
    recoverFromReusedNonce: recoverFromReusedNonce,
    certificate: certificate, signCertificate: signCertificate,
    certificateBody: certificateBody, validateChain: validateChain,
    matchesName: matchesName
  };
}));
