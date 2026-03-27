const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

if (burger && nav) {
  burger.addEventListener('click', () => {
    const isOpen = nav.style.display === 'flex';

    if (isOpen) {
      nav.style.display = 'none';
      return;
    }

    nav.style.display = 'flex';
    nav.style.flexDirection = 'column';
    nav.style.position = 'absolute';
    nav.style.top = '64px';
    nav.style.left = '0';
    nav.style.right = '0';
    nav.style.background = '#fff';
    nav.style.borderBottom = '1px solid #e8e8e8';
    nav.style.padding = '12px';
    nav.style.gap = '8px';
  });
}

// Product page interactions (safe on other pages)
const qtyInput = document.getElementById('qtyInput');
const qtyMinus = document.getElementById('qtyMinus');
const qtyPlus = document.getElementById('qtyPlus');

if (qtyInput && qtyMinus && qtyPlus) {
  qtyMinus.addEventListener('click', () => {
    const val = Math.max(1, parseInt(qtyInput.value || '1', 10) - 1);
    qtyInput.value = val;
  });

  qtyPlus.addEventListener('click', () => {
    const val = parseInt(qtyInput.value || '1', 10) + 1;
    qtyInput.value = val;
  });

  const sizeBtns = document.querySelectorAll('.size');
  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeBtns.forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
    });
  });
}

// Sync qty/size into hidden inputs for cart form
const sizeHidden = document.getElementById('sizeHidden');
const qtyHidden = document.getElementById('qtyHidden');

if (qtyInput && qtyHidden) {
  const syncQty = () => { qtyHidden.value = qtyInput.value || '1'; };
  qtyInput.addEventListener('input', syncQty);
  syncQty();
}

if (sizeHidden) {
  const sizeBtns = document.querySelectorAll('.size');
  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeBtns.forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      sizeHidden.value = btn.textContent.trim();
    });
  });
}

const newArrivalImages = [
  '/images/ITDOliveGreenHoodieFModel.png',
  '/images/ITDOliveGreenHoodieMModel.png',
  '/images/ITDBlackTeeMModel.png',
  'images/ITDBlackTeeFModel.png',
];

let newArrivalIndex = 0;
const newArrivalsImage = document.getElementById('newArrivalsImage');

if (newArrivalsImage) {
  setInterval(() => {
    newArrivalIndex = (newArrivalIndex + 1) % newArrivalImages.length;
    newArrivalsImage.src = newArrivalImages[newArrivalIndex];
  }, 3000);
}

