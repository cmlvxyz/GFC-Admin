(function () {
  'use strict';

  var fileInput = document.getElementById('fileInput');
  var previews = document.getElementById('previews');
  var uploadBtn = document.getElementById('uploadBtn');
  var uploadBtnLabel = document.getElementById('uploadBtnLabel');

  if (!fileInput || !previews || !uploadBtn) return;

  var storedSignaturePromise = null;
  var checkTimer = null;
  var checking = false;
  var lastPreviewSignature = '';

  function setUploadAvailability(hasDuplicate, ready) {
    if (hasDuplicate) {
      uploadBtn.disabled = true;
      uploadBtn.classList.remove('hidden');
      uploadBtn.classList.remove('progress');
      if (uploadBtnLabel) uploadBtnLabel.textContent = 'Remove duplicates to upload';
      return;
    }
    if (ready) {
      uploadBtn.disabled = false;
      if (uploadBtnLabel && uploadBtnLabel.textContent === 'Remove duplicates to upload') {
        uploadBtnLabel.textContent = 'Upload Photos';
      }
    } else {
      uploadBtn.disabled = true;
    }
  }

  function imageSignature(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var size = 64;
          var canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          var data = ctx.getImageData(0, 0, size, size).data;
          var bytes = new Uint8Array(size * size);
          var i;
          for (i = 0; i < bytes.length; i++) {
            var r = data[i * 4];
            var g = data[i * 4 + 1];
            var b = data[i * 4 + 2];
            var lum = Math.round((299 * r + 587 * g + 114 * b) / 1000);
            bytes[i] = lum >> 3;
          }
          if (window.crypto && crypto.subtle) {
            crypto.subtle.digest('SHA-256', bytes).then(function (hash) {
              var view = new Uint8Array(hash);
              var hex = '';
              for (i = 0; i < view.length; i++) hex += view[i].toString(16).padStart(2, '0');
              resolve(hex);
            }).catch(function () { resolve(null); });
          } else {
            resolve(Array.prototype.join.call(bytes, ','));
          }
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function collectStoredUrls(data) {
    var urls = [];
    (Array.isArray(data && data.events) ? data.events : []).forEach(function (event) {
      (Array.isArray(event.dateEntries) ? event.dateEntries : []).forEach(function (entry) {
        (Array.isArray(entry.photos) ? entry.photos : []).forEach(function (url) {
          if (typeof url === 'string' && url.trim()) urls.push(url.trim());
        });
      });
    });
    (Array.isArray(data && data.allPhotos) ? data.allPhotos : []).forEach(function (album) {
      (Array.isArray(album.photos) ? album.photos : []).forEach(function (url) {
        if (typeof url === 'string' && url.trim()) urls.push(url.trim());
      });
    });
    return Array.from(new Set(urls));
  }

  function resolveStoredUrl(url) {
    if (/^data:/i.test(url) || /^https?:\/\//i.test(url)) return url;
    return location.origin + (url.charAt(0) === '/' ? url : '/' + url);
  }

  function loadStoredSignatures() {
    if (storedSignaturePromise) return storedSignaturePromise;
    storedSignaturePromise = fetch('/api/content', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('content');
        return res.json();
      })
      .then(function (data) {
        var urls = collectStoredUrls(data);
        return Promise.all(urls.map(function (url) {
          return imageSignature(resolveStoredUrl(url));
        }));
      })
      .catch(function () { return []; });
    return storedSignaturePromise;
  }

  function getPreviewImages() {
    return Array.prototype.map.call(previews.querySelectorAll('.preview img'), function (img) {
      return img.currentSrc || img.src;
    }).filter(Boolean);
  }

  async function checkDuplicates() {
    var sources = getPreviewImages();
    if (!sources.length) {
      checking = false;
      setUploadAvailability(false, false);
      return;
    }

    var signature = sources.join('|');
    if (signature === lastPreviewSignature && !checking) return;
    lastPreviewSignature = signature;
    checking = true;
    setUploadAvailability(false, false);

    var storedSignatures = await loadStoredSignatures();
    var storedSet = new Set(storedSignatures.filter(Boolean));
    var selectedSet = new Set();
    var duplicateFound = false;
    var results = await Promise.all(sources.map(function (src) { return imageSignature(src); }));
    var nodes = previews.querySelectorAll('.preview');

    results.forEach(function (sig, index) {
      if (!nodes[index]) return;
      var duplicate = !!sig && (storedSet.has(sig) || selectedSet.has(sig));
      if (sig) selectedSet.add(sig);
      if (duplicate) duplicateFound = true;
      nodes[index].classList.toggle('duplicate', duplicate);
      if (duplicate) nodes[index].classList.remove('done');
      var rm = nodes[index].querySelector('.rm');
      if (rm) {
        rm.classList.toggle('duplicate-rm', duplicate);
        rm.setAttribute('aria-label', duplicate ? 'Remove duplicate photo' : 'Remove photo');
      }
    });

    checking = false;
    setUploadAvailability(duplicateFound, true);
  }

  function scheduleCheck() {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(checkDuplicates, 250);
  }

  fileInput.addEventListener('change', function () {
    lastPreviewSignature = '';
    storedSignaturePromise = null;
    setUploadAvailability(false, false);
    scheduleCheck();
  });

  var observer = new MutationObserver(function () { scheduleCheck(); });
  observer.observe(previews, { childList: true, subtree: true });

  var status = document.getElementById('status');
  if (status && window.MutationObserver) {
    var statusObserver = new MutationObserver(function () {
      if (/^📤\s*Uploading\s+/i.test(status.textContent) || /^📤\s*Uploaded\s+/i.test(status.textContent)) {
        status.textContent = 'Uploading...';
      }
    });
    statusObserver.observe(status, { childList: true, characterData: true, subtree: true });
  }
})();