import { Store } from './store.js';
import { auth } from './auth.js';

const store = new Store();
let selectedFamily = null;
let selectedUnit = 'piece';

document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    const user = auth.checkAuth();
    if (!user) return;
    document.getElementById('user-initials').textContent = user.avatar;

    renderFamilies();
    setupListeners();
});

function renderFamilies() {
    const list = document.getElementById('family-list');
    list.innerHTML = store.data.families.map((f, index) => `
        <button class="family-btn ${index === 0 ? 'active' : ''}" data-id="${f.id}" onclick="selectFamily('${f.id}', this)">
            <i class="fa-solid ${f.icon}"></i>
            <span>${f.name}</span>
        </button>
    `).join('');

    // Select first by default
    if (store.data.families.length > 0) {
        selectedFamily = store.data.families[0].id;
    }
}

window.selectFamily = (id, el) => {
    selectedFamily = id;
    document.querySelectorAll('.family-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
};

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

    // Unit Selection
    document.querySelectorAll('.unit-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedUnit = btn.getAttribute('data-val');
        };
    });

    // Reset
    document.getElementById('btn-clear').onclick = () => {
        document.getElementById('m-name').value = '';
        document.getElementById('m-qty').value = 1;
        document.getElementById('m-name').focus();
    };

    // SAVE
    document.getElementById('btn-save').onclick = () => {
        const name = document.getElementById('m-name').value.trim();
        const qty = parseInt(document.getElementById('m-qty').value);

        if (!name) {
            alert('Please enter an item name');
            return;
        }

        if (qty <= 0) {
            alert('Quantity must be greater than 0');
            return;
        }

        // Add Item
        const newItem = {
            id: 'i' + Date.now(),
            name: name,
            ref: 'm-' + Date.now().toString().substr(-6),
            familyId: selectedFamily,
            quantity: qty,
            unit: selectedUnit,
            minQuantity: 10, // Default
            price: 0,
            image: null // No image upload in quick mode
        };

        store.addItem(newItem);

        // Log movement
        store.addMovement({
            id: Date.now(),
            itemId: newItem.id,
            itemName: newItem.name,
            type: 'incoming', // Mobile add is usually 'incoming' (Donation)
            quantity: qty,
            reason: 'Quick Add (Mobile)',
            date: new Date().toISOString().replace('T', ' ').substring(0, 16),
            user: auth.getCurrentUser().name
        });

        // Show Feedback
        const toast = document.getElementById('toast');
        toast.classList.remove('hidden');

        // Reset Logic
        setTimeout(() => {
            toast.classList.add('hidden');
            document.getElementById('m-name').value = '';
            document.getElementById('m-qty').value = 1;
        }, 1500);
    };
}
