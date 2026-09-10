(function () {
  var params = new URLSearchParams(location.search);
  var eventId = (params.get('event') || '').trim();
  var dateParam = (params.get('date') || '').trim();
  var isNumericDate = /^\d+$/.test(dateParam);
  var dateIndex = dateParam === '' ? 0 : (isNumericDate ? (parseInt(dateParam, 10) || 0) : -1);
  var isAllPhotosMode = !eventId;

  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var YEAR_RANGE = [];
  var currentYear = new Date().getFullYear();
  for (var y = 2021; y <= 2030; y++) YEAR_RANGE.push(y);

  var viewLoading = document.getElementById('viewLoading');
  var viewError = document.getElementById('viewError');
  var errorTitle = document.getElementById('errorTitle');
  var errorText = document.getElementById('errorText');
  var retryBtn = document.getElementById('retryBtn');
  var viewUpload = document.getElementById('viewUpload');
  var viewSuccess = document.getElementById('viewSuccess');
  var viewBye = document.getElementById('viewBye');
  var eventTitle = document.getElementById('eventTitle');
  var eventDate = document.getElementById('eventDate');
  var dropzone = document.getElementById('dropzone');
  var fileInput = document.getElementById('fileInput');
  var previews = document.getElementById('previews');
  var uploadBtn = document.getElementById('uploadBtn');
  var uploadBtnLabel = document.getElementById('uploadBtnLabel');
  var status = document.getElementById('status');
  var successText = document.getElementById('successText');
  var uploadMoreBtn = document.getElementById('uploadMoreBtn');
  var exitBtn = document.getElementById('exitBtn');
  var galleryMonth = document.getElementById('galleryMonth');
  var galleryYear = document.getElementById('galleryYear');
  var gallerySummary = document.getElementById('gallerySummary');
  var galleryGroups = document.getElementById('galleryGroups');
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxClose = document.getElementById('lightboxClose');

  var viewPicker = document.getElementById('viewPicker');
  var pickerMonth = document.getElementById('pickerMonth');
  var pickerYear = document.getElementById('pickerYear');
  var pickerLabel = document.getElementById('pickerLabel');
  var pickerGo = document.getElementById('pickerGo');
  var pickerStatus = document.getElementById('pickerStatus');

  var photos = [];
  var uploading = false;
  var allMonth = '';
  var allYear = '';
  var allDate = '';

  // Always set the dropzone button label so it never renders empty.
  if (dropzone) {
    dropzone.textContent = '📸 Choose Photos';
    dropzone.setAttribute('aria-label', 'Choose photos to upload');
  }

  function show(view) {
    [viewLoading, viewError, viewUpload, viewSuccess, viewPicker, viewBye].forEach(function (v) {
      if (v) v.classList.add('hidden');
    });
    if (view) view.classList.remove('hidden');
  }

  function setStatus(text, type) {
    status.textContent = text || '';
    status.className = 'status' + (type ? ' ' + type : '');
  }

  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var reader = new FileReader();
      reader.onload = function (e) {
        img.onload = function () {
          var MAX = 1200;
          var scale = Math.min(1, MAX / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderPreviews() {
    previews.innerHTML = '';
    photos.forEach(function (p, index) {
      var div = document.createElement('div');
      div.className = 'preview' + (p.done ? ' done' : '');
      var img = document.createElement('img');
      img.src = p.url;
      var rm = document.createElement('button');
      rm.className = 'rm';
      rm.type = 'button';
      rm.textContent = '\u2715';
      rm.onclick = function () {
        photos.splice(index, 1);
        renderPreviews();
        uploadBtn.classList.toggle('hidden', photos.length === 0);
        setStatus('');
      };
      div.appendChild(img);
      div.appendChild(rm);
      previews.appendChild(div);
    });
    uploadBtn.classList.toggle('hidden', photos.length === 0);
  }

  function addFiles(fileList) {
    var fileArr = Array.from(fileList || []).filter(function (f) { return f && f.type && f.type.indexOf('image') === 0; });
    var remaining = fileArr.length;
    if (remaining === 0) return;
    uploadBtn.classList.add('hidden');
    setStatus('🔄 Processing ' + remaining + ' photo' + (remaining > 1 ? 's' : '') + '...');
    fileArr.forEach(function (file) {
      resizeImage(file).then(function (dataUrl) {
        photos.push({ url: dataUrl, done: false });
        renderPreviews();
        remaining--;
        if (remaining === 0) {
          setStatus(photos.length + ' photo' + (photos.length > 1 ? 's' : '') + ' ready');
          uploadBtn.classList.remove('hidden');
        }
      }).catch(function () {
        remaining--;
        setStatus('May hindi na-load na image. Pakisubukan muli.', 'err');
      });
    });
    fileInput.value = '';
  }

  async function uploadAll() {
    if (uploading || photos.length === 0) return;
    uploading = true;
    uploadBtn.disabled = true;
    uploadBtnLabel.textContent = 'Uploading...';
    uploadBtn.classList.add('progress');

    var total = photos.length;
    var ok = 0;
    var failed = [];

    // Sequential uploads: one request finishes before the next starts.
    // No artificial delay is added; this keeps uploads reliable while allowing
    // the backend to process each image as quickly as it can.
    for (var i = 0; i < total; i++) {
      var p = photos[i];
      setStatus('Uploading...');
      try {
        var body;
        if (isAllPhotosMode) {
          body = { image: p.url, month: allMonth, year: allYear, date: allDate };
        } else {
          body = { image: p.url, eventId: eventId, dateIndex: dateIndex };
        }
        var res = await fetch('/api/uploads' + (isAllPhotosMode ? '/all' : ''), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Upload failed');
        p.done = true;
        ok++;
        renderPreviews();
        setStatus('Uploading...');
      } catch (err) {
        failed.push({ index: i, error: err });
      }
    }

    uploading = false;
    uploadBtn.disabled = false;

    if (ok === total) {
      if (successText) successText.textContent = '✅ ' + (total === 1 ? 'Na-upload na ang iyong photo.' : total + ' photos ang na-upload. Salamat po!');
      showSuccessWithGallery();
    } else if (ok > 0) {
      if (successText) successText.textContent = '⚠️ ' + ok + ' of ' + total + ' photos ang na-upload. ' + failed.length + ' ang hindi na-upload.';
      showSuccessWithGallery();
    } else {
      uploadBtnLabel.textContent = 'Upload Photos';
      uploadBtn.classList.remove('progress');
      setStatus('❌ Upload failed. Please try again.', 'err');
    }
  }

  var galleryAlbums = [];
  var galleryEvents = [];
  var galleryState = { month: '', year: '', expanded: null };

  function resolvePhotoUrlPublic(u) {
    if (u.indexOf('data:') === 0 || /^https?:\/\//i.test(u)) return u;
    var host = (location.hostname || '');
    var isLocal = !host || host === 'localhost' || host === '127.0.0.1' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    var base = isLocal ? 'http://' + host + ':3002' : location.origin;
    return base + (u.indexOf('/') === 0 ? '' : '/') + u;
  }

  function parseEntryDatePublic(value) {
    if (!value) return null;
    var hasYear = /\d{4}/.test(value);
    var d = new Date(hasYear ? value : (value + ', ' + currentYear));
    if (isNaN(d.getTime())) return null;
    return { month: d.getMonth(), year: d.getFullYear() };
  }

  function showSuccessWithGallery() {
    show(viewSuccess);
    galleryAlbums = [];
    galleryEvents = [];
    fetch('/api/content')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        galleryAlbums = Array.isArray(data.allPhotos) ? data.allPhotos : [];
        galleryEvents = Array.isArray(data.events) ? data.events : [];
        galleryMonth.value = String(galleryState.month);
        galleryYear.value = String(galleryState.year);
        renderSuccessGallery();
      })
      .catch(function () {
        renderSuccessGallery();
      });
  }

  function galleryItems() {
    var items = [];
    var seen = {};
    function push(url, m, y, date) {
      var stored = String(url);
      var key = m + '|' + y + '|' + stored;
      if (seen[key]) return;
      seen[key] = true;
      items.push({ url: resolvePhotoUrlPublic(stored), month: m, year: y, date: date });
    }
    galleryEvents.forEach(function (ev) {
      if (!Array.isArray(ev.dateEntries)) return;
      ev.dateEntries.forEach(function (entry) {
        var parsed = parseEntryDatePublic(entry.date);
        var m = parsed ? parsed.month : -1;
        var y = parsed ? parsed.year : -1;
        var date = String(entry.date || '');
        (Array.isArray(entry.photos) ? entry.photos : []).forEach(function (url) {
          push(url, m, y, date);
        });
      });
    });
    galleryAlbums.forEach(function (album) {
      var m = typeof album.month === 'number' ? album.month : -1;
      var y = typeof album.year === 'number' ? album.year : -1;
      var date = String(album.date || '');
      (Array.isArray(album.photos) ? album.photos : []).forEach(function (url) {
        push(url, m, y, date);
      });
    });
    return items;
  }

  function renderSuccessGallery() {
    var items = galleryItems();
    var total = items.length;

    galleryMonth.innerHTML = '<option value="">All Months (' + total + ' photos)</option>';
    MONTH_NAMES.forEach(function (name, idx) {
      var c = items.filter(function (p) { return p.month === idx; }).length;
      galleryMonth.innerHTML += '<option value="' + idx + '">' + name + ' (' + c + ' photos)</option>';
    });
    galleryMonth.value = String(galleryState.month === '' ? '' : galleryState.month);

    galleryYear.innerHTML = '<option value="">All Years</option>';
    YEAR_RANGE.forEach(function (year) {
      var c = items.filter(function (p) { return p.year === year; }).length;
      galleryYear.innerHTML += '<option value="' + year + '">' + year + ' (' + c + ' photos)</option>';
    });
    galleryYear.value = String(galleryState.year === '' ? '' : galleryState.year);

    var filtered = items.filter(function (p) {
      return (galleryState.month === '' || p.month === galleryState.month) &&
             (galleryState.year === '' || p.year === galleryState.year);
    });
    var summary = '📸';
    if (galleryState.month === '' && galleryState.year === '') {
      summary += ' ' + total + ' total photos';
    } else if (galleryState.month === '') {
      summary += ' ' + filtered.length + ' photos in ' + galleryState.year;
    } else if (galleryState.year === '') {
      summary += ' ' + filtered.length + ' photos — ' + MONTH_NAMES[galleryState.month];
    } else {
      summary += ' ' + filtered.length + ' photos — ' + MONTH_NAMES[galleryState.month] + ' ' + galleryState.year;
    }
    gallerySummary.textContent = summary;

    var order = [];
    var byKey = {};
    filtered.forEach(function (p) {
      var key = p.year === -1 ? 'x-other' : p.year + '-' + p.month;
      if (!byKey[key]) {
        byKey[key] = [];
        order.push({
          key: key,
          label: p.year === -1 ? '📁 Other / Not Categorized' : MONTH_NAMES[p.month] + ' ' + p.year,
          photos: []
        });
      }
      byKey[key].push(p);
    });
    order.sort(function (a, b) {
      var ka = a.key === 'x-other' ? [-1, -1] : a.key.split('-').map(Number);
      var kb = b.key === 'x-other' ? [-1, -1] : b.key.split('-').map(Number);
      return (kb[0] - ka[0]) || (kb[1] - ka[1]);
    });
    order.forEach(function (g) { g.photos = byKey[g.key]; });

    if (order.length === 0) {
      galleryGroups.innerHTML = '<div class="gallery-empty">' +
        (total === 0 ? 'No photos yet. Upload some photos using the QR code.' : 'No photos found for the selected filters.') +
        '</div>';
      return;
    }

    if (galleryState.expanded === null || !byKey[galleryState.expanded]) {
      galleryState.expanded = order[0].key;
    }

    galleryGroups.innerHTML = '';
    order.forEach(function (group) {
      var expanded = galleryState.expanded === group.key;
      var count = group.photos.length;

      var head = document.createElement('div');
      head.className = 'gallery-group-head';
      head.onclick = function () {
        galleryState.expanded = expanded ? null : group.key;
        renderSuccessGallery();
      };

      var gl = document.createElement('div');
      gl.className = 'gl';
      var h4 = document.createElement('h4');
      h4.textContent = group.label;
      var cnt = document.createElement('span');
      cnt.className = 'count';
      cnt.textContent = count + ' photo' + (count !== 1 ? 's' : '');
      gl.appendChild(h4);
      gl.appendChild(cnt);

      var chev = document.createElement('span');
      chev.className = 'chev';
      chev.textContent = expanded ? '▲' : '▼';

      head.appendChild(gl);
      head.appendChild(chev);

      var body = document.createElement('div');
      body.className = 'gallery-group-body';
      var grid = document.createElement('div');
      grid.className = 'gallery-grid';

      if (expanded) {
        group.photos.forEach(function (photo) {
          grid.appendChild(makeGalleryThumb(photo, photo.date || group.label, false, function () {
            openLightbox(photo.url);
          }));
        });
      } else {
        if (group.photos.length > 0) {
          grid.appendChild(makeGalleryThumb(group.photos[0], count + ' photo(s) • Click to expand', true, function () {
            galleryState.expanded = group.key;
            renderSuccessGallery();
          }));
        } else {
          var none = document.createElement('div');
          none.className = 'gthumb-empty';
          none.textContent = 'No photos';
          grid.appendChild(none);
        }
      }

      body.appendChild(grid);

      var wrap = document.createElement('div');
      wrap.className = 'gallery-group';
      wrap.appendChild(head);
      wrap.appendChild(body);
      galleryGroups.appendChild(wrap);
    });
  }

  function makeGalleryThumb(photo, label, isCover, onClickCb) {
    var div = document.createElement('div');
    div.className = 'gthumb' + (isCover ? ' cover' : '');
    var img = document.createElement('img');
    img.src = photo.url;
    img.loading = 'lazy';
    img.alt = label;
    img.onerror = function () {
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100%" height="100%"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="12" fill="%23999"%3ENo image%3C/text%3E%3C/svg%3E';
    };
    var ovl = document.createElement('div');
    ovl.className = 'ovl';
    ovl.textContent = label;

    if (typeof onClickCb === 'function') {
      div.onclick = onClickCb;
    }

    div.appendChild(img);
    div.appendChild(ovl);
    return div;
  }

  function openLightbox(url) {
    lightboxImg.src = url;
    lightbox.classList.remove('hidden');
  }

  function closeLightbox() {
    lightbox.classList.add('hidden');
    lightboxImg.src = '';
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  galleryMonth.addEventListener('change', function () {
    galleryState.month = galleryMonth.value === '' ? '' : parseInt(galleryMonth.value, 10);
    renderSuccessGallery();
  });

  galleryYear.addEventListener('change', function () {
    galleryState.year = galleryYear.value === '' ? '' : parseInt(galleryYear.value, 10);
    renderSuccessGallery();
  });

  function exitToPreviousPage() {
    var ref = (document.referrer || '').trim();
    if (ref && /^https?:/i.test(ref)) {
      location.href = ref;
      return;
    }
    if (window.history.length > 1) {
      history.back();
      return;
    }
    try {
      if (window.opener) {
        window.close();
        return;
      }
    } catch (e) {}
    location.href = '/';
  }

  exitBtn.addEventListener('click', exitToPreviousPage);

  function resetAndGoBack() {
    photos = [];
    renderPreviews();
    uploadBtn.classList.remove('progress');
    uploadBtn.disabled = false;
    uploadBtnLabel.textContent = 'Upload Photos';
    uploadBtn.classList.add('hidden');
    setStatus('');
    show(viewUpload);
    fileInput.value = '';
  }

  // Dropzone is a button now — no drag-and-drop handlers.
  dropzone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function (e) { addFiles(e.target.files); });
  uploadBtn.addEventListener('click', uploadAll);

  uploadMoreBtn.addEventListener('click', function () {
    resetAndGoBack();
  });

  function showAllPhotosPicker() {
    show(viewPicker);
    pickerStatus.textContent = '';
    pickerStatus.className = 'status';

    pickerMonth.innerHTML = '<option value="">-- Pumili ng month --</option>' +
      MONTH_NAMES.map(function (m, i) { return '<option value="' + i + '">' + m + '</option>'; }).join('');
    pickerYear.innerHTML = '<option value="">-- Pumili ng year --</option>' +
      YEAR_RANGE.map(function (y) { return '<option value="' + y + '"' + (y === currentYear ? ' selected' : '') + '>' + y + '</option>'; }).join('');
    if (pickerLabel) pickerLabel.value = '';
    pickerMonth.focus();
  }

  pickerGo.addEventListener('click', function () {
    var m = pickerMonth.value;
    var y = pickerYear.value;
    if (m === '' || y === '') {
      pickerStatus.textContent = 'Pumili ng month at year.';
      pickerStatus.className = 'status err';
      return;
    }
    allMonth = parseInt(m, 10);
    allYear = parseInt(y, 10);
    var labelValue = pickerLabel ? (pickerLabel.value || '').trim() : '';
    allDate = labelValue || (MONTH_NAMES[allMonth] + ' ' + allYear);

    eventTitle.textContent = MONTH_NAMES[allMonth] + ' ' + allYear;
    eventDate.textContent = allDate;
    document.title = 'Photo Upload | ' + allDate;
    show(viewUpload);
  });

  async function loadEvent() {
    try {
      var res = await fetch('/api/content');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var event = (data.events || []).find(function (e) { return String(e.id) === String(eventId); });
      if (!event) throw new Error('not found');
      var entries = Array.isArray(event.dateEntries) ? event.dateEntries : [];
      var entry = null;
      if (dateIndex >= 0) {
        entry = entries[dateIndex] || null;
      } else if (dateParam) {
        for (var j = 0; j < entries.length; j++) {
          if (String(entries[j].date).replace(/\s+/g, '') === dateParam.replace(/\s+/g, '')) {
            dateIndex = j;
            entry = entries[j];
            break;
          }
        }
      }
      if (!entry && dateParam && !isNumericDate) {
        errorTitle.textContent = 'Hindi mahanap ang date album';
        errorText.innerHTML = 'Mukhang hindi balido ang QR code na ito.<br/>Subukan muli o i-contact ang church admin.';
        show(viewError);
        return;
      }
      document.title = 'Photo Upload | ' + event.title;
      eventTitle.textContent = event.title;
      eventDate.textContent = entry && entry.date ? entry.date : (event.date || '');
      show(viewUpload);
    } catch (err) {
      if (err && err.message === 'not found') {
        errorTitle.textContent = 'Hindi mahanap ang event';
        errorText.innerHTML = 'Mukhang hindi balido ang QR code na ito.<br/>Subukan muli o i-contact ang church admin.';
        show(viewError);
      } else {
        errorTitle.textContent = 'Cannot connect to server';
        errorText.innerHTML = 'Hindi makakonekta sa GFC server. Pakisiguraduhing tumatakbo ang backend (npm run server).<br/>Pindutin ang Retry para subukan muli.';
        show(viewError);
      }
    }
  }

  retryBtn.addEventListener('click', function () {
    if (isAllPhotosMode) {
      showAllPhotosPicker();
    } else {
      show(viewLoading);
      loadEvent();
    }
  });

  if (isAllPhotosMode) {
    showAllPhotosPicker();
  } else {
    loadEvent();
  }
})();
