(function () {
  var params = new URLSearchParams(location.search);
  var eventId = (params.get('event') || '').trim();
  var dateIndex = parseInt(params.get('date') || '0', 10) || 0;

  var viewLoading = document.getElementById('viewLoading');
  var viewError = document.getElementById('viewError');
  var errorTitle = document.getElementById('errorTitle');
  var errorText = document.getElementById('errorText');
  var retryBtn = document.getElementById('retryBtn');
  var viewUpload = document.getElementById('viewUpload');
  var viewSuccess = document.getElementById('viewSuccess');
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

  var viewPicker = document.getElementById('viewPicker');
  var pickerEvent = document.getElementById('pickerEvent');
  var pickerDate = document.getElementById('pickerDate');
  var pickerDateWrap = document.getElementById('pickerDateWrap');
  var pickerGo = document.getElementById('pickerGo');
  var pickerStatus = document.getElementById('pickerStatus');

  var photos = [];
  var uploading = false;
  var eventsCache = [];

  function show(view) {
    viewLoading.classList.add('hidden');
    viewError.classList.add('hidden');
    viewUpload.classList.add('hidden');
    viewSuccess.classList.add('hidden');
    viewPicker.classList.add('hidden');
    view.classList.remove('hidden');
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
          var MAX = 1600;
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
          resolve(canvas.toDataURL('image/jpeg', 0.85));
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
      rm.textContent = '✕';
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
    setStatus('');
    fileArr.forEach(function (file) {
      resizeImage(file).then(function (dataUrl) {
        photos.push({ url: dataUrl, done: false });
        renderPreviews();
        remaining--;
        if (remaining === 0) setStatus('');
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
    for (var i = 0; i < total; i++) {
      var photo = photos[i];
      setStatus('Uploading ' + (i + 1) + ' of ' + total + '...');
      try {
        var res = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: photo.url, eventId: eventId, dateIndex: dateIndex })
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Upload failed');
        photo.done = true;
        renderPreviews();
        ok++;
      } catch (err) {
        if (err && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
          setStatus('Cannot connect to server. Pakisiguraduhing tumatakbo ang GFC backend (npm run server).', 'err');
        } else {
          setStatus('Error uploading photo ' + (i + 1) + ': ' + err.message, 'err');
        }
        break;
      }
    }
    uploading = false;
    uploadBtn.disabled = false;
    if (ok === total) {
      successText.textContent = 'Your ' + (total === 1 ? 'photo has' : total + ' photos have') + ' been uploaded successfully. Salamat po!';
      show(viewSuccess);
    } else {
      uploadBtnLabel.textContent = 'Upload Photos';
      uploadBtn.classList.remove('progress');
      setStatus(ok + ' of ' + total + ' uploaded. Failed photos remain for retry.', ok > 0 ? 'ok' : 'err');
    }
  }

  dropzone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function (e) { addFiles(e.target.files); });
  ['dragenter', 'dragover'].forEach(function (ev) { dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('dragging'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('dragging'); }); });
  dropzone.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
  uploadBtn.addEventListener('click', uploadAll);
  uploadMoreBtn.addEventListener('click', function () { photos = []; renderPreviews(); show(viewUpload); setStatus(''); });

  function setPickerStatus(text, type) {
    pickerStatus.textContent = text || '';
    pickerStatus.className = 'status' + (type ? ' ' + type : '');
  }

  function populateEventOptions() {
    var withAlbums = eventsCache.filter(function (e) {
      return Array.isArray(e.dateEntries) && e.dateEntries.length > 0;
    });
    pickerEvent.innerHTML = '<option value="">-- Pumili ng event --</option>' +
      withAlbums.map(function (e, i) { return '<option value="' + i + '">' + e.title + '</option>'; }).join('');
    pickerDate.innerHTML = '<option value="">-- Pumili ng date --</option>';
    pickerDate.disabled = true;
    pickerDateWrap.style.opacity = '0.45';
    pickerDateWrap.style.pointerEvents = 'none';
    pickerGo.disabled = true;
    return withAlbums;
  }

  function showPicker() {
    show(viewPicker);
    setPickerStatus('');
    fetch('/api/content')
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) {
        eventsCache = (data.events || []).filter(function (e) {
          return Array.isArray(e.dateEntries) && e.dateEntries.length > 0;
        });
        if (eventsCache.length === 0) {
          setPickerStatus('Wala pang event na may date album. Magdagdag muna ng date sa admin.', 'err');
          return;
        }
        populateEventOptions();
        pickerEvent.focus();
      })
      .catch(function () {
        setPickerStatus('Hindi makakonekta sa server. Pakisiguraduhing tumatakbo ang backend.', 'err');
      });
  }

  pickerEvent.addEventListener('change', function () {
    var idx = parseInt(pickerEvent.value, 10);
    var ev = eventsCache[idx];
    if (!ev) {
      pickerDate.innerHTML = '<option value="">-- Pumili ng date --</option>';
      pickerDate.disabled = true;
      pickerDateWrap.style.opacity = '0.45';
      pickerDateWrap.style.pointerEvents = 'none';
      pickerGo.disabled = true;
      return;
    }
    pickerDate.innerHTML = '<option value="">-- Pumili ng date --</option>' +
      ev.dateEntries.map(function (entry, di) {
        return '<option value="' + di + '">' + (entry.date || ('Album ' + (di + 1))) + '</option>';
      }).join('');
    pickerDate.disabled = false;
    pickerDateWrap.style.opacity = '1';
    pickerDateWrap.style.pointerEvents = 'auto';
    pickerGo.disabled = true;
    setPickerStatus('');
  });

  pickerDate.addEventListener('change', function () {
    pickerGo.disabled = !(pickerEvent.value !== '' && pickerDate.value !== '');
    setPickerStatus('');
  });

  pickerGo.addEventListener('click', function () {
    var idx = parseInt(pickerEvent.value, 10);
    var di = parseInt(pickerDate.value, 10);
    var ev = eventsCache[idx];
    if (!ev || isNaN(di)) return;
    eventId = ev.id;
    dateIndex = di;
    document.title = 'Photo Upload | ' + ev.title;
    eventTitle.textContent = ev.title;
    eventDate.textContent = (ev.dateEntries[di] && ev.dateEntries[di].date) || ev.date || '';
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
      var entry = entries[dateIndex];
      document.title = 'Photo Upload | ' + event.title;
      eventTitle.textContent = event.title;
      eventDate.textContent = entry && entry.date ? entry.date : (event.date || '');
      show(viewUpload);
    } catch (err) {
      if (err && err.message === 'not found') {
        showPicker();
      } else {
        errorTitle.textContent = 'Cannot connect to server';
        errorText.innerHTML = 'Hindi makakonekta sa GFC server. Pakisiguraduhing tumatakbo ang backend (npm run server).<br/>Pindutin ang Retry para subukan muli.';
        show(viewError);
      }
    }
  }

  retryBtn.addEventListener('click', function () {
    show(viewLoading);
    loadEvent();
  });

  if (!eventId) {
    showPicker();
  } else { loadEvent(); }
})();