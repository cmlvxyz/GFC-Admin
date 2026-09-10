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
  var reconcilePromise = null;

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

  function collectStoredOccurrences(data) {
    var occurrences = [];

    (Array.isArray(data && data.events) ? data.events : []).forEach(function (event) {
      var isSunday = String(event && event.id || '').toLowerCase() === 'sunday' ||
        String(event && event.title || '').toLowerCase().indexOf('sunday service') !== -1;
      if (!isSunday) return;

      (Array.isArray(event.dateEntries) ? event.dateEntries : []).forEach(function (entry, dateEntryIndex) {
        var dateValue = String(entry && entry.date || '').trim();
        var parsed = parseDateValue(dateValue);
        (Array.isArray(entry.photos) ? entry.photos : []).forEach(function (url, photoIndex) {
          if (typeof url !== 'string' || !url.trim()) return;
          occurrences.push({
            source: 'event',
            eventId: event.id,
            dateEntryIndex: dateEntryIndex,
            photoIndex: photoIndex,
            url: url.trim(),
            dateKey: parsed ? parsed.key : dateValue.toLowerCase(),
            timestamp: parsed ? parsed.timestamp : 0
          });
        });
      });
    });

    return occurrences;
  }

  function parseDateValue(value) {
    if (!value) return null;
    var currentYear = new Date().getFullYear();
    var d = new Date(/\d{4}/.test(value) ? value : (value + ', ' + currentYear));
    if (isNaN(d.getTime())) return null;
    return {
      timestamp: d.getTime(),
      key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    };
  }

  function resolveStoredUrl(url) {
    if (/^data:/i.test(url) || /^https?:\/\//i.test(url)) return url;
    return location.origin + (url.charAt(0) === '/' ? url : '/' + url);
  }

  async function fetchContent() {
    var res = await fetch('/api/content', { cache: 'no-store' });
    if (!res.ok) throw new Error('content');
    return res.json();
  }

  /*
   * The Sunday Service gallery is date-aware. If exactly the same photo is
   * stored under two different Sunday Service dates, the newer date wins.
   * Example: August 30 wins over June 21; July 5 wins over June 14.
   * Only the older occurrence is removed. The newer occurrence is preserved.
   */
  async function reconcileSundayServiceDuplicates() {
    if (reconcilePromise) return reconcilePromise;

    reconcilePromise = (async function () {
      try {
        var data = await fetchContent();
        var occurrences = collectStoredOccurrences(data);
        if (occurrences.length < 2) return;

        var uniqueUrls = Array.from(new Set(occurrences.map(function (o) { return o.url; })));
        var signatureResults = await Promise.all(uniqueUrls.map(function (url) {
          return imageSignature(resolveStoredUrl(url));
        }));
        var signatureByUrl = new Map();
        uniqueUrls.forEach(function (url, i) {
          if (signatureResults[i]) signatureByUrl.set(url, signatureResults[i]);
        });

        var groups = new Map();
        occurrences.forEach(function (occurrence) {
          var sig = signatureByUrl.get(occurrence.url);
          if (!sig) return;
          if (!groups.has(sig)) groups.set(sig, []);
          groups.get(sig).push(occurrence);
        });

        var deletions = [];
        groups.forEach(function (group) {
          var distinctDates = Array.from(new Set(group.map(function (o) { return o.dateKey; })));
          if (distinctDates.length < 2) return;

          var newestTimestamp = Math.max.apply(null, group.map(function (o) { return o.timestamp || 0; }));
          if (!newestTimestamp) return;

          group.forEach(function (occurrence) {
            if ((occurrence.timestamp || 0) < newestTimestamp) deletions.push(occurrence);
          });
        });

        /* Delete by exact occurrence, never by URL globally. */
        for (var i = 0; i < deletions.length; i++) {
          var occurrence = deletions[i];
          try {
            await fetch('/api/events/photo/delete', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                eventId: occurrence.eventId,
                dateEntryIndex: occurrence.dateEntryIndex,
                photoUrl: occurrence.url
              })
            });
          } catch (e) {
            /* A later refresh will retry reconciliation if a deletion fails. */
          }
        }
      } catch (e) {
        /* Duplicate checking must never prevent normal photo selection. */
      } finally {
        reconcilePromise = null;
      }
    })();

    return reconcilePromise;
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

  function loadStoredSignatures() {
    if (storedSignaturePromise) return storedSignaturePromise;
    storedSignaturePromise = reconcileSundayServiceDuplicates()
      .then(function () { return fetchContent(); })
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

  /* Reconcile existing Sunday Service duplicates as soon as the upload page
     connects to the shared GFC Admin database. */
  reconcileSundayServiceDuplicates().then(function () {
    storedSignaturePromise = null;
    scheduleCheck();
  });
})();