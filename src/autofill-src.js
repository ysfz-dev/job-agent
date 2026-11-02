// The autofill bookmarklet's source. Built into public/autofill.html by
// `node src/build-autofill.js`, which inlines the profile values.
//
// This is plain JavaScript you run on a page you opened yourself. There is no
// automation framework, no CDP, no headless browser — navigator.webdriver stays
// false because nothing is driving the browser. It fills a form the same way a
// password manager does, and you review and submit by hand.
//
// __PROFILE__ is replaced at build time.

(function () {
  const P = __PROFILE__;

  // React, Angular and Vue all track input state internally; assigning .value
  // updates the DOM but not the framework, so the value silently reverts on
  // submit. Going through the native setter and firing the events the framework
  // listens for is what makes the fill actually stick.
  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Everything a form might call a field: its own attributes plus the visible
  // label text. ATS vendors name fields inconsistently ("job_application_
  // answers_attributes_0_text_value"), so the label is often the only signal.
  function contextOf(el) {
    const bits = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'),
      el.getAttribute('data-qa'), el.getAttribute('autocomplete')];
    if (el.id) {
      const lab = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (lab) bits.push(lab.innerText);
    }
    const wrap = el.closest('label, .field, .form-group, [class*="field"], [class*="question"]');
    if (wrap) bits.push(wrap.innerText.slice(0, 160));
    return bits.filter(Boolean).join(' ').toLowerCase();
  }

  // Order matters: "first name" must be tested before the looser "name".
  const RULES = [
    [/first\s*name|given\s*name|forename/, P.firstName],
    [/last\s*name|surname|family\s*name/, P.lastName],
    [/full\s*name|^name$|your\s*name|applicant\s*name|candidate\s*name/, P.fullName],
    [/e-?mail/, P.email],
    [/phone|mobile|telephone|contact\s*number/, P.phone],
    [/linked\s*in/, P.linkedin],
    [/git\s*hub/, P.github],
    [/portfolio|personal\s*(web)?site|website|blog/, P.website],
    [/current\s*(employer|company)|present\s*company|company\s*name/, P.currentCompany],
    [/current\s*(job\s*)?title|current\s*role|job\s*title|position\s*title/, P.currentTitle],
    [/years?\s*(of\s*)?(relevant\s*)?experience|experience\s*\(years\)|yoe/, P.yearsExperience],
    [/city|town/, P.addressCity],
    // Nationality before country: "Bahrain" is not an answer to "Nationality".
    [/nationality|citizenship/, P.nationality],
    [/country|location/, P.addressCountry],
    [/university|college|school|institution/, P.university],
    [/degree|qualification|major|field\s*of\s*study/, P.degree],
    [/graduat\w*\s*(year|date)|year\s*of\s*graduation/, P.graduationYear],
    [/notice\s*period|availability|available\s*from|start\s*date/, P.noticePeriod],
    [/salary|compensation|expected\s*pay|remuneration/, P.salaryExpectation],
  ];

  // Yes/no screening questions, matched by meaning. A null answer is skipped
  // rather than guessed — these are the questions that auto-reject you.
  const YESNO = [
    [/sponsor|visa\s*(support|sponsorship)|require\s*sponsorship/, P.requiresSponsorship],
    [/legally\s*authorh?i[sz]ed|right\s*to\s*work|work\s*authorh?i[sz]ation|eligible\s*to\s*work/, P.authorizedInCountry],
    [/relocat/, P.willingToRelocate],
    [/travel/, P.willingToTravel],
  ];

  let filled = 0;
  const skipped = [];

  function mark(el, ok) {
    el.style.outline = ok ? '2px solid #16a34a' : '2px solid #f59e0b';
    el.style.outlineOffset = '1px';
  }

  document.querySelectorAll('input, textarea, select').forEach((el) => {
    if (el.disabled || el.readOnly || el.type === 'hidden' || el.type === 'file') return;
    if (el.type === 'password' || el.type === 'search') return;

    const ctx = contextOf(el);
    if (!ctx) return;

    // Checkboxes and radios: only the yes/no questions.
    if (el.type === 'checkbox' || el.type === 'radio') {
      for (const [re, answer] of YESNO) {
        if (!re.test(ctx) || answer === null) continue;
        const wants = /^(yes|true)$/i.test(String(answer));
        const isYes = /yes|true/i.test(el.value + ' ' + ctx.slice(0, 40));
        if (el.type === 'radio' && isYes === wants && !el.checked) { el.click(); filled++; mark(el, true); }
        break;
      }
      return;
    }

    if (el.tagName === 'SELECT') {
      for (const [re, answer] of YESNO) {
        if (!re.test(ctx) || answer === null) continue;
        const want = String(answer).toLowerCase();
        const opt = [...el.options].find((o) => o.text.trim().toLowerCase().startsWith(want));
        if (opt) { el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true })); filled++; mark(el, true); }
        break;
      }
      return;
    }

    if (el.value && el.value.trim()) return;   // never overwrite what is there

    for (const [re, value] of RULES) {
      if (!re.test(ctx)) continue;
      if (!value) { skipped.push(ctx.slice(0, 48).replace(/\s+/g, ' ')); mark(el, false); break; }
      setValue(el, value);
      filled++;
      mark(el, true);
      break;
    }
  });

  const note = document.createElement('div');
  note.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:340px;'
    + 'background:#111827;color:#f9fafb;font:13px/1.5 system-ui,sans-serif;padding:14px 16px;'
    + 'border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.35)';
  note.innerHTML = '<b>Filled ' + filled + ' field' + (filled === 1 ? '' : 's') + '</b>'
    + '<div style="opacity:.75;margin-top:6px">Green outline = filled. Amber = matched but '
    + 'blank in your profile.</div>'
    + (skipped.length
      ? '<div style="margin-top:8px;color:#fbbf24">Left for you: ' + [...new Set(skipped)].slice(0, 4).join(', ') + '</div>'
      : '')
    + '<div style="margin-top:10px;opacity:.75">Check every field, then submit yourself.</div>';
  note.onclick = () => note.remove();
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 12000);
})();
