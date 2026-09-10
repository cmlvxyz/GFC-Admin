(function () {
  var params = new URLSearchParams(location.search);
  var eventId = (params.get('event') || '').trim();
  // The QR code now uses the ACTUAL selected date value (e.g. "August 30")
  // as the date parameter. Old QR codes used a numeric dateEntries index
  // (e.g. "1"). Keep supporting the numeric format for old QR codes.
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
  var autoHideTimer = null; // Timer for auto-hide

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

  // 🔥 OPTIMIZED: Faster resize with lower quality
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var reader = new FileReader();
      reader.onload = function (e) {
        img.onload = function () {
          // Reduced from 1600 to 1200 for faster upload
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
          // Reduced quality from 0.85 to 0.75 for smaller file
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
          // Auto-show upload button
          uploadBtn.classList.remove('hidden');
        }
      }).catch(function () {
        remaining--;
        setStatus('May hindi na-load na image. Pakisubukan muli.', 'err');
      });
    });
    fileInput.value = '';
  }

  // 🔥 OPTIMIZED: Parallel uploads with progress
  async function uploadAll() {
    if (uploading || photos.length === 0) return;
    uploading = true;
    uploadBtn.disabled = true;
    uploadBtnLabel.textContent = 'Uploading...';
    uploadBtn.classList.add('progress');
    
    var total = photos.length;
    var ok = 0;
    var failed = [];
    
    // Upload all photos in parallel (Promise.all)
    var uploadPromises = [];
    var progressUpdate = function(index) {
      setStatus('📤 Uploading ' + (index + 1) + ' of ' + total + '...');
    };
    
    for (var i = 0; i < total; i++) {
      var photo = photos[i];
      var promise = (function(idx, p) {
        return (async function() {
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
            setStatus('📤 Uploaded ' + ok + ' of ' + total);
          } catch (err) {
            failed.push({ index: idx, error: err });
          }
        })();
      })(i, photo);
      uploadPromises.push(promise);
    }
    
    // Wait for all uploads to complete
    await Promise.all(uploadPromises);
    
    uploading = false;
    uploadBtn.disabled = false;
    
    if (ok === total) {
      // 🔥 ALL SUCCESS - Show success with auto-hide
      successText.textContent = '✅ ' + (total === 1 ? 'Your photo has' : total + ' photos have') + ' been uploaded successfully. Salamat po!';
      showSuccessWithAutoHide();
    } else if (ok > 0) {
      // PARTIAL SUCCESS
      successText.textContent = '⚠️ ' + ok + ' of ' + total + ' photos uploaded. ' + failed.length + ' failed.';
      showSuccessWithAutoHide();
    } else {
      // ALL FAILED
      uploadBtnLabel.textContent = 'Upload Photos';
      uploadBtn.classList.remove('progress');
      setStatus('❌ Upload failed. Please try again.', 'err');
    }
  }

  // 🔥 NEW: Show success with auto-hide after 3 seconds
  function showSuccessWithAutoHide() {
    // Clear any existing timer
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
    
    show(viewSuccess);
    
    // Auto-hide after 3 seconds and reset
    autoHideTimer = setTimeout(function() {
      autoHideTimer = null;
      resetAndGoBack();
    }, 1000);
  }

  // 🔥 NEW: Reset and go back to upload form
  function resetAndGoBack() {
    // Clear photos
    photos = [];
    renderPreviews();
    
    // Reset upload button
    uploadBtn.classList.remove('progress');
    uploadBtn.disabled = false;
    uploadBtnLabel.textContent = 'Upload Photos';
    uploadBtn.classList.add('hidden');
    
    // Clear status
    setStatus('');
    
    // Go back to upload view
    show(viewUpload);
    
    // Reset file input
    fileInput.value = '';
  }

  // Dropzone events
  dropzone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function (e) { addFiles(e.target.files); });
  ['dragenter', 'dragover'].forEach(function (ev) { 
    dropzone.addEventListener(ev, function (e) { 
      e.preventDefault(); 
      dropzone.classList.add('dragging'); 
    }); 
  });
  ['dragleave', 'drop'].forEach(function (ev) { 
    dropzone.addEventListener(ev, function (e) { 
      e.preventDefault(); 
      dropzone.classList.remove('dragging'); 
    }); 
  });
  dropzone.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
  uploadBtn.addEventListener('click', uploadAll);
  
  // 🔥 FIXED: Upload More button - reset and go back
  uploadMoreBtn.addEventListener('click', function () {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
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
    pickerLabel.value = '';
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
    allDate = (pickerLabel.value || '').trim() || MONTH_NAMES[allMonth] + ' ' + allYear;

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
        // Match the ACTUAL selected date string against the date entries
        // (single source of truth). Never fall back to an arbitrary index.
        // Matching is whitespace-insensitive so the QR value "August30"
        // matches the entry date "August 30".
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