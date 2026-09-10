(function () {
  // Duplicate detection is handled by upload.js so it stays tied to the
  // actual resized preview item. This helper only normalizes legacy status text.
  var status = document.getElementById('status');
  if (!status || !window.MutationObserver) return;

  var observer = new MutationObserver(function () {
    if (/^📤\s*Uploading\s+/i.test(status.textContent) || /^📤\s*Uploaded\s+/i.test(status.textContent)) {
      status.textContent = 'Uploading...';
    }
  });
  observer.observe(status, { childList: true, characterData: true, subtree: true });
})();