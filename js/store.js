import { db } from './firebase-config.js';
import {
    collection,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    addDoc,
    query,
    orderBy,
    getDoc
} from "firebase/firestore";

export class Store {
    constructor(onRefresh) {
        this.data = {
            users: [],
            items: [],
            families: [],
            movements: [],
            gallery: []
        };
        this.onRefresh = onRefresh;
        this.setupListeners();
    }

    setupListeners() {
        const collections = ['users', 'items', 'families', 'movements', 'gallery'];

        collections.forEach(colName => {
            const q = query(collection(db, colName));
            onSnapshot(q, (snapshot) => {
                this.data[colName] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Special handling for nested requirements in families if needed
                if (colName === 'families') {
                    this.data.families.forEach(f => {
                        if (!f.requirements) f.requirements = [];
                    });
                }

                // Sorting for movements and gallery (newest first)
                if (colName === 'movements' || colName === 'gallery') {
                    this.data[colName].sort((a, b) => (b.date || b.id) - (a.date || a.id));
                }

                if (this.onRefresh) this.onRefresh();
            });
        });
    }

    // --- Gallery Management ---
    async addGalleryImage(image) {
        try {
            await addDoc(collection(db, "gallery"), {
                ...image,
                timestamp: Date.now()
            });
        } catch (e) { console.error(e); }
    }

    async deleteGalleryImage(id) {
        try {
            await deleteDoc(doc(db, "gallery", id));
        } catch (e) { console.error(e); }
    }

    // --- Family Management ---
    async addFamily(family) {
        try {
            await setDoc(doc(db, "families", family.id), family);
        } catch (e) { console.error(e); }
    }

    async updateFamily(id, updates) {
        try {
            await updateDoc(doc(db, "families", id), updates);
        } catch (e) { console.error(e); }
    }

    async deleteFamily(id) {
        try {
            await deleteDoc(doc(db, "families", id));
        } catch (e) { console.error(e); }
    }

    async updateFamilyRequirement(familyId, itemId, quantity) {
        const family = this.data.families.find(f => f.id === familyId);
        if (!family) return;

        let requirements = [...family.requirements];
        const reqIndex = requirements.findIndex(r => r.itemId === itemId);

        if (quantity <= 0) {
            if (reqIndex !== -1) requirements.splice(reqIndex, 1);
        } else {
            if (reqIndex !== -1) {
                requirements[reqIndex].quantity = parseInt(quantity);
            } else {
                requirements.push({ itemId, quantity: parseInt(quantity) });
            }
        }

        await this.updateFamily(familyId, { requirements });
    }

    // --- Item Management ---
    async addItem(item) {
        try {
            await setDoc(doc(db, "items", item.id), item);
        } catch (e) { console.error(e); }
    }

    async updateItem(id, updates) {
        try {
            await updateDoc(doc(db, "items", id), updates);
        } catch (e) { console.error(e); }
    }

    async deleteItem(id) {
        try {
            await deleteDoc(doc(db, "items", id));
        } catch (e) { console.error(e); }
    }

    async addMovement(movement) {
        try {
            // 1. Add movement log
            await addDoc(collection(db, "movements"), {
                ...movement,
                timestamp: Date.now()
            });

            // 2. Update item quantity
            const item = this.data.items.find(i => i.id === movement.itemId);
            if (item) {
                let newQty = item.quantity;
                if (movement.type === 'incoming') newQty += parseInt(movement.quantity);
                else if (movement.type === 'outgoing') newQty -= parseInt(movement.quantity);
                else if (movement.type === 'adjustment') newQty += parseInt(movement.quantity);

                await this.updateItem(item.id, { quantity: newQty });
            }
        } catch (e) { console.error(e); }
    }

    // --- User Management ---
    async addUser(user) {
        try {
            // For cloud sync, we use email as ID or the provided ID
            await setDoc(doc(db, "users", user.email.toLowerCase()), user);
        } catch (e) { console.error(e); }
    }

    async updateUser(id, updates) {
        try {
            // Find by ID or email
            const user = this.data.users.find(u => u.id == id || u.email == id);
            if (user) {
                await updateDoc(doc(db, "users", user.email.toLowerCase()), updates);
            }
        } catch (e) { console.error(e); }
    }

    async deleteUser(id) {
        try {
            const user = this.data.users.find(u => u.id == id || u.email == id);
            if (user) {
                await deleteDoc(doc(db, "users", user.email.toLowerCase()));
            }
        } catch (e) { console.error(e); }
    }

    // --- Analytics Getters (Local Data) ---
    getStats() {
        const totalItems = this.data.items.reduce((acc, item) => acc + (item.quantity || 0), 0);
        const lowStockCount = this.data.items.filter(i => (i.quantity || 0) <= (i.minQuantity || 10)).length;
        const totalValue = this.data.items.reduce((acc, item) => acc + ((item.quantity || 0) * (item.price || 0)), 0);
        return { totalItems, lowStockCount, totalValue, familiesCount: this.data.families.length };
    }

    getFamilyStats() {
        return this.data.families.map(f => {
            const items = this.data.items.filter(i => i.familyId === f.id);
            const count = items.reduce((acc, i) => acc + (i.quantity || 0), 0);
            return { ...f, count };
        });
    }

    getCapacityForFamily(familyId) {
        const family = this.data.families.find(f => f.id === familyId);
        if (!family || !family.requirements || family.requirements.length === 0) return 0;

        let minFams = Infinity;
        family.requirements.forEach(req => {
            const item = this.data.items.find(i => i.id === req.itemId);
            if (item) {
                const possible = Math.floor((item.quantity || 0) / req.quantity);
                if (possible < minFams) minFams = possible;
            } else {
                minFams = 0;
            }
        });
        return minFams === Infinity ? 0 : minFams;
    }

    getNeededForTarget(familyId, count) {
        const family = this.data.families.find(f => f.id === familyId);
        if (!family) return [];

        return family.requirements.map(req => {
            const item = this.data.items.find(i => i.id === req.itemId);
            const totalNeeded = req.quantity * count;
            const current = item ? (item.quantity || 0) : 0;
            return {
                itemName: item ? item.name : 'Deleted Item',
                totalNeeded,
                current,
                lack: Math.max(0, totalNeeded - current)
            };
        });
    }
}
