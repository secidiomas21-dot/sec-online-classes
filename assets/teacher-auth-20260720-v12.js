(() => {
  'use strict';

  const STORAGE_KEY = 'sec-teacher-access-v12';
  const PASSWORD_HASH = '59c30328f911934418f5e63a36c11130ec641a8cc35f7ac3655d86b600fa20c6';

  async function sha256(value) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function isAuthorized() {
    return sessionStorage.getItem(STORAGE_KEY) === 'granted';
  }

  async function validate(password) {
    if (!password) return false;
    return (await sha256(password)) === PASSWORD_HASH;
  }

  function grant() {
    sessionStorage.setItem(STORAGE_KEY, 'granted');
  }

  function clear() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  window.SEC_TEACHER_AUTH = { isAuthorized, validate, grant, clear };
})();
