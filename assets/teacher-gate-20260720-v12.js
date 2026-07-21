(() => {
  'use strict';

  const auth = window.SEC_TEACHER_AUTH;
  if (!auth) return;

  const entryButton = document.querySelector('#teacher-access');
  const gate = document.querySelector('#teacher-gate');
  const form = document.querySelector('#teacher-login-form');
  const passwordInput = document.querySelector('#teacher-password');
  const errorMessage = document.querySelector('#teacher-login-error');
  const closeButtons = document.querySelectorAll('[data-close-teacher-gate]');
  const protectedContent = document.querySelectorAll('.teacher-protected');
  const isTeacherPage = document.body.dataset.page === 'teacher';

  function setError(message) {
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.hidden = !message;
  }

  function openGate() {
    if (!gate) return;
    gate.hidden = false;
    document.body.classList.add('teacher-gate-open');
    setError('');
    if (passwordInput) {
      passwordInput.value = '';
      window.setTimeout(() => passwordInput.focus(), 30);
    }
  }

  function closeGate() {
    if (!gate || isTeacherPage) return;
    gate.hidden = true;
    document.body.classList.remove('teacher-gate-open');
    setError('');
  }

  function unlockTeacherPage() {
    protectedContent.forEach((element) => {
      element.hidden = false;
    });
    if (gate) gate.hidden = true;
    document.body.classList.remove('teacher-gate-open', 'teacher-page-locked');
  }

  async function submitPassword(event) {
    event.preventDefault();
    setError('');

    const submitButton = form?.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const valid = await auth.validate(passwordInput?.value || '');
      if (!valid) {
        setError('Incorrect password. Please try again.');
        passwordInput?.select();
        return;
      }

      auth.grant();
      if (isTeacherPage) {
        unlockTeacherPage();
      } else {
        window.location.assign('teacher.html');
      }
    } catch (error) {
      console.error('Teacher authentication failed:', error);
      setError('Could not verify the password. Please reload the page.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  entryButton?.addEventListener('click', () => {
    if (auth.isAuthorized()) {
      window.location.assign('teacher.html');
      return;
    }
    openGate();
  });

  form?.addEventListener('submit', submitPassword);
  closeButtons.forEach((button) => button.addEventListener('click', closeGate));

  gate?.addEventListener('click', (event) => {
    if (event.target === gate) closeGate();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && gate && !gate.hidden) closeGate();
  });

  if (isTeacherPage) {
    if (auth.isAuthorized()) unlockTeacherPage();
    else openGate();
  }
})();
