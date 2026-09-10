(function () {
  var fileInput = document.getElementById('fileInput');
  var previews = document.getElementById('previews');
  var status = document.getElementById('status');
  if (!fileInput || !previews) return;

  function resizeToComparableDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      var img = new Image();
      reader.onload = function (e) {
        img.onload = function () {
          var max = 1200;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function dataUrlBytes(dataUrl) {
    var base64 = String(dataUrl).split(',')[1] || '';
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function hashBytes(bytes) {
    var digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  async function hashImageUrl(url) {
    var text = String(url || '').trim();
    if (text.indexOf('data:') === 0) return hashBytes(dataUrlBytes(text));
    var host = location.hostname || '';
    var local = !host || host === 'localhost' || host === '127.0.0.1' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    var base = local ? 'http://' + host + ':3002' : location.origin;
    var resolved = /^https?:\/\//i.test(text) ? text : base + (text.indexOf('/') === 0 ? '' : '/') + text;
    var response = await fetch(resolved, { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to read stored image');
    return hashBytes(new Uint8Array(await response.arrayBuffer()));
  }

  async function markDuplicates(files) {
    try {
      var contentResponse = await fetch('/api/content', { cache: 'no-store' });
      if (!contentResponse.ok) return;
      var content = await contentResponse.json();
      var stored = [];

      (Array.isArray(content.events) ? content.events : []).forEach(function (event) {
        (Array.isArray(event.dateEntries) ? event.dateEntries : []).forEach(function (entry) {
          (Array.isArray(entry.photos) ? entry.photos : []).forEach(function (url) { stored.push(url); });
        });
      });
      (Array.isArray(content.allPhotos) ? content.allPhotos : []).forEach(function (album) {
        (Array.isArray(album.photos) ? album.photos : []).forEach(function (url) { stored.push(url); });
      });

      var storedHashes = new Set();
      for (var s = 0; s < stored.length; s++) {
        try { storedHashes.add(await hashImageUrl(stored[s])); } catch (e) {}
      }

      var selectedHashes = new Map();
      for (var i = 0; i < files.length; i++) {
        try {
          var comparable = await resizeToComparableDataUrl(files[i]);
          var hash = await hashImageUrl(comparable);
          var duplicate = storedHashes.has(hash) || selectedHashes.has(hash);
          if (duplicate) {
            var node = previews.children[i];
            if (node) node.classList.add('duplicate');
            if (selectedHashes.has(hash)) {
              var previousIndex = selectedHashes.get(hash);
              if (previews.children[previousIndex]) previews.children[previousIndex].classList.add('duplicate');
            }
          }
          if (!selectedHashes.has(hash)) selectedHashes.set(hash, i);
        } catch (e2) {}
      }
    } catch (e3) {
      console.warn('Duplicate photo detection unavailable:', e3);
    }
  }

  fileInput.addEventListener('change', function () {
    var files = Array.from(fileInput.files || []).filter(function (file) {
      return file && file.type && file.type.indexOf('image') === 0;
    });
    if (!files.length) return;
    setTimeout(function () { markDuplicates(files); }, 250);
  });

  // Keep the upload status text simple: only show "Uploading..." while uploading.
  if (status && window.MutationObserver) {
    var observer = new MutationObserver(function () {
      if (/^📤\s*Uploading\s+/i.test(status.textContent) || /^📤\s*Uploaded\s+/i.test(status.textContent)) {
        status.textContent = 'Uploading...';
      }
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  }
})();
