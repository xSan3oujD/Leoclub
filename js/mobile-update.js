import { Store } from './store.js';
import { auth } from './auth.js';

const store = new Store(() => {
    attemptInit();
    if (currentItem) {
        currentItem = store.data.items.find(i => i.id === currentItem.id);
        renderItemDetails();
    }
});
let selectedType = 'incoming';
let selectedReason = 'Donation';
let currentItem = null;

document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    const user = auth.checkAuth();
    if (!user) return;
    document.getElementById('user-initials').textContent = user.avatar;

    attemptInit();
    setupListeners();
});

function attemptInit() {
    if (currentItem) return; // Already init

    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('id');

    if (!itemId) {
        alert('No item specified');
        window.location.href = 'index.html';
        return;
    }

    const item = store.data.items.find(i => i.id === itemId);
    if (item) {
        currentItem = item;
        renderItemDetails();
    } else if (store.data.items.length > 0) {
        // Data loaded but item really missing
        alert('Item not found in database');
        window.location.href = 'index.html';
    }
}

function renderItemDetails() {
    document.getElementById('m-name').textContent = currentItem.name;
    document.getElementById('current-stock').textContent = `${currentItem.quantity} ${currentItem.unit}`;
}

function setupListeners() {
    // Quantity Steppers
    const qtyInput = document.getElementById('m-qty');

    document.getElementById('btn-minus').onclick = () => {
        let val = parseInt(qtyInput.value) || 0;
        if (val > 1) qtyInput.value = val - 1;
    };

    document.getElementById('btn-plus').onclick = () => {
        let val = parseInt(qtyInput.value) || 0;
        qtyInput.value = val + 1;
    };

    // Reason Selection
    document.querySelectorAll('.unit-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedReason = btn.getAttribute('data-reason');
            selectedType = btn.getAttribute('data-type');

            // Visual feedback on button type
            const actionBtn = document.getElementById('btn-save');
            if (selectedType === 'outgoing') {
                actionBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i> REMOVE STOCK';
            } else {
                actionBtn.innerHTML = '<i class="fa-solid fa-check"></i> UPDATE STOCK';
            }
        };
    });

    // SAVE
    document.getElementById('btn-save').onclick = () => {
        const qty = parseInt(document.getElementById('m-qty').value);

        if (qty <= 0) {
            alert('Quantity must be greater than 0');
            return;
        }

        if (selectedType === 'outgoing' && currentItem.quantity < qty) {
            alert(`Not enough stock! Current: ${currentItem.quantity}`);
            return;
        }

        // Log movement (Store handles quantity update automatically)
        store.addMovement({
            id: Date.now(),
            itemId: currentItem.id,
            itemName: currentItem.name,
            type: selectedType,
            quantity: qty,
            reason: selectedReason + ' (Mobile)',
            date: new Date().toISOString().replace('T', ' ').substring(0, 16),
            user: auth.getCurrentUser().name
        });

        // Show Feedback
        const toast = document.getElementById('toast');
        toast.classList.remove('hidden');

        // Refresh details
        currentItem = store.data.items.find(i => i.id === currentItem.id); // Re-fetch
        renderItemDetails();

        // Redirect logic? Or stay?
        setTimeout(() => {
            toast.classList.add('hidden');
            document.getElementById('m-qty').value = 1;
        }, 1500);
    };
}
