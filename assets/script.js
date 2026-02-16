// تفعيل الحفظ التلقائي والميزات المتقدمة
document.addEventListener('DOMContentLoaded', function() {
    console.log('✓ تم تحميل script.js بنجاح');
    setupAutoSave();
    setupSearch();
});

// الحفظ التلقائي للحقول القابلة للتعديل
function setupAutoSave() {
    const editableInputs = document.querySelectorAll('.editable');
    
    editableInputs.forEach(input => {
        input.addEventListener('change', function() {
            const row = this.closest('tr');
            if (!row) return;

            const id = row.dataset.id;
            const field = this.dataset.field;
            const value = this.value;

            const table = this.closest('table');
            let endpoint = '';

            if (table && table.id === 'purchasesTable') {
                endpoint = '/purchases/update';
            } else if (table && table.id === 'salesTable') {
                endpoint = '/sales/update';
            }

            if (endpoint) {
                fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, field, value })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        showNotification('تم حفظ التغيير بنجاح', 'success');
                        updateRowTotal(row);
                    }
                })
                .catch(err => {
                    console.error('خطأ في الحفظ:', err);
                    showNotification('حدث خطأ في الحفظ', 'error');
                });
            }
        });
    });
}

// إعداد البحث والتصفية
function setupSearch() {
    const searchInputs = document.querySelectorAll('[id^="searchInput"]');
    searchInputs.forEach(input => {
        input.addEventListener('keyup', function() {
            filterTable(this);
        });
    });
}

// تحديث إجمالي الصف
function updateRowTotal(row) {
    const quantityInput = row.querySelector('input[data-field="quantity"]');
    const priceInput = row.querySelector('input[data-field="price"]');
    
    if (quantityInput && priceInput) {
        const quantity = parseFloat(quantityInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;
        const total = (quantity * price).toFixed(2);
        
        const cells = row.querySelectorAll('td');
        if (cells.length > 4) {
            cells[4].textContent = total;
        }
    }
}

// دالة البحث والتصفية
function filterTable(searchInput) {
    const input = searchInput.value.toLowerCase();
    const table = searchInput.closest('.container')?.querySelector('table');
    
    if (!table) return;

    const rows = table.getElementsByTagName('tbody')[0]?.getElementsByTagName('tr');
    if (!rows) return;

    let visibleCount = 0;
    for (let row of rows) {
        let match = false;
        const cells = row.querySelectorAll('td input, td select, td');
        
        for (let cell of cells) {
            const text = (cell.value || cell.textContent || '').toLowerCase();
            if (text.includes(input)) {
                match = true;
                break;
            }
        }
        
        row.style.display = match ? '' : 'none';
        if (match) visibleCount++;
    }

    // عرض رسالة إذا لم توجد نتائج
    if (visibleCount === 0 && input.length > 0) {
        console.log('لم يتم العثور على نتائج');
    }
}

// إظهار إشعارات
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        ${type === 'success' ? 'background: #2ecc71;' : ''}
        ${type === 'error' ? 'background: #e74c3c;' : ''}
        ${type === 'info' ? 'background: #3498db;' : ''}
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// دالة لطباعة الفاتورة
function printInvoice(tableId, title) {
    const table = document.getElementById(tableId);
    if (!table) {
        showNotification('لا توجد بيانات للطباعة', 'error');
        return;
    }

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>' + title + '</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: Arial; direction: rtl; padding: 20px; }');
    printWindow.document.write('h2 { text-align: center; color: #2c3e50; margin-bottom: 10px; }');
    printWindow.document.write('p { text-align: center; color: #7f8c8d; margin-bottom: 20px; }');
    printWindow.document.write('table { width: 100%; border-collapse: collapse; }');
    printWindow.document.write('th { background: #3498db; color: white; padding: 10px; text-align: right; border: 1px solid #ddd; }');
    printWindow.document.write('td { padding: 10px; text-align: right; border: 1px solid #ddd; }');
    printWindow.document.write('tr:nth-child(even) { background: #f9f9f9; }');
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h2>' + title + '</h2>');
    printWindow.document.write('<p>التاريخ: ' + new Date().toLocaleDateString('ar-SA') + '</p>');
    
    // نسخ الجدول مع إزالة حقول الإدخال
    const clonedTable = table.cloneNode(true);
    const inputs = clonedTable.querySelectorAll('input, select');
    inputs.forEach(input => {
        const td = input.parentElement;
        td.textContent = input.value;
    });
    
    printWindow.document.write(clonedTable.outerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

// دالة لحذف صف
function deleteRow(id, endpoint) {
    if (confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
        fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const row = document.querySelector(`tr[data-id="${id}"]`);
                if (row) {
                    row.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => row.remove(), 300);
                    showNotification('تم حذف العنصر بنجاح', 'success');
                }
            }
        })
        .catch(err => {
            console.error('خطأ في الحذف:', err);
            showNotification('حدث خطأ في الحذف', 'error');
        });
    }
}

// دالة لتصدير البيانات إلى CSV
function exportToCSV(data, filename) {
    let csv = [];
    
    if (data.length > 0) {
        const headers = Object.keys(data[0]);
        csv.push(headers.join(','));
        
        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
            });
            csv.push(values.join(','));
        });
    }
    
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('تم تصدير البيانات بنجاح', 'success');
}

// دالة لحساب الإجمالي
function calculateTotal(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return 0;

    let total = 0;
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const quantityInput = row.querySelector('input[data-field="quantity"]');
        const priceInput = row.querySelector('input[data-field="price"]');
        
        if (quantityInput && priceInput) {
            const quantity = parseFloat(quantityInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            total += quantity * price;
        }
    });
    
    return total.toFixed(2);
}

// إضافة أنماط الرسوم المتحركة
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
