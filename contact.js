// Contact form: validation + sending.
//
// The original form's backend wasn't visible, so choose how messages get delivered:
//   1. Paste a form-service URL below (Formspree, Getform, your own PHP/Node endpoint...)
//      and the form will POST the fields to it.
//   2. Leave it empty and the form opens the visitor's email app with the message
//      pre-filled to the address below (works everywhere, no backend needed).
const FORM_ENDPOINT = '';                         // e.g. 'https://formspree.io/f/xxxxxxx'
const RECEIVER_EMAIL = 'info@xclusiverentcars.com';
// Needs common.js loaded first (for waLink, WHATSAPP_NUMBER, toast).

(function () {
  const form = document.getElementById('contactForm');
  const msg = document.getElementById('formMsg');

  const rules = {
    name:     v => v.trim().length >= 2 || 'Please enter your name.',
    email:    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Please enter a valid email address.',
    phone:    v => /^[+\d][\d\s()-]{6,}$/.test(v.trim()) || 'Please enter a valid phone number.',
    comments: v => v.trim().length >= 5 || 'Please tell us a little more.'
  };

  function setStatus(text, ok) {
    msg.textContent = text;
    msg.className = 'form-msg ' + (ok ? 'ok' : 'err');
  }

  function validate() {
    let valid = true;
    for (const [field, test] of Object.entries(rules)) {
      const el = form.elements[field];
      const result = test(el.value);
      el.classList.toggle('invalid', result !== true);
      if (result !== true && valid) { setStatus(result, false); el.focus(); }
      if (result !== true) valid = false;
    }
    return valid;
  }

  form.querySelectorAll('input, textarea').forEach(el =>
    el.addEventListener('input', () => el.classList.remove('invalid')));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    const btn = form.querySelector('button[type="submit"]');

    if (FORM_ENDPOINT) {
      btn.disabled = true;
      setStatus('Sending...', true);
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Request failed');
        form.reset();
        setStatus('Thank you! Your message has been sent. We will get back to you shortly.', true);
      } catch (err) {
        setStatus('Sorry, something went wrong. Please call us or try again.', false);
      } finally {
        btn.disabled = false;
      }
    } else {
      const subject = encodeURIComponent('Website enquiry from ' + data.name);
      const body = encodeURIComponent(
        `Name: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\n\n${data.comments}`);
      window.location.href = `mailto:${RECEIVER_EMAIL}?subject=${subject}&body=${body}`;
      setStatus('Opening your email app so you can send the message.', true);
    }
  });

  // "Send on WhatsApp": same message, sent through WhatsApp instead of email
  const wa = document.getElementById('waSend');
  if (wa) wa.addEventListener('click', () => {
    if (!validate()) return;
    const d = Object.fromEntries(new FormData(form).entries());
    const text = `Hello Xclusive Rent A Car, my name is ${d.name}.\n${d.comments}\nPhone: ${d.phone}`;
    if (!WHATSAPP_NUMBER && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('Your message is copied. Paste it into the WhatsApp chat.'), () => {});
    }
    window.open(waLink(text), '_blank', 'noopener');
  });
})();
