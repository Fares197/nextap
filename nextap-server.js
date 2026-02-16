const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { createObjectCsvWriter } = require('csv-writer');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد قاعدة البيانات
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, role TEXT, name TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, product TEXT, quantity INTEGER, price REAL, date TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, product TEXT, quantity INTEGER, price REAL, customerName TEXT, customerPhone TEXT, paymentMethod TEXT, date TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS prep_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, product TEXT, quantity INTEGER, status TEXT, date TEXT, note TEXT)");
	    db.run("CREATE TABLE IF NOT EXISTS filament (id INTEGER PRIMARY KEY AUTOINCREMENT, color TEXT, weight REAL, material TEXT, quantity INTEGER, price REAL, date TEXT)");
	    db.run("CREATE TABLE IF NOT EXISTS returns (id INTEGER PRIMARY KEY AUTOINCREMENT, product TEXT, quantity INTEGER, reason TEXT, date TEXT, status TEXT DEFAULT 'pending')");
	    db.run("CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, companyName TEXT, companyAddress TEXT, companyPhone TEXT, companyEmail TEXT, defaultMaterial TEXT, printerSettings TEXT, nfcTagProvider TEXT, nfcProgrammingSoftware TEXT, currency TEXT DEFAULT 'JOD')");
    db.run("CREATE TABLE IF NOT EXISTS digital_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE, name TEXT, title TEXT, bio TEXT, phone TEXT, email TEXT, website TEXT, linkedin TEXT, instagram TEXT, twitter TEXT, template TEXT, theme_color TEXT, profile_image TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
	    db.get("SELECT * FROM settings WHERE id = 1", (err, row) => {
        if (err) {
            console.error("Error checking settings table:", err);
            return;
        }
	        if (!row) {
	            db.run("INSERT INTO settings (companyName, companyAddress, companyPhone, companyEmail, defaultMaterial, printerSettings, nfcTagProvider, nfcProgrammingSoftware) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
	            ["Nextap 3D Printing", "الرياض، المملكة العربية السعودية", "+966 50 123 4567", "info@nextap3d.com", "PLA", "سرعة الطباعة: 60 مم/ثانية، درجة حرارة الفوهة: 200 درجة مئوية", "NXP Semiconductors", "NFC Tools Pro", "JOD"]);
	        }
	    });

    // إضافة مستخدم افتراضي إذا لم يوجد
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (username, password, role, name) VALUES ('admin', 'FARES HTS 2020', 'admin', 'فارس (المدير)')");
        }
    });
});

const ejsMate = require("ejs-mate");
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'nextap-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/login');
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.status(403).send('عذراً، لا تملك صلاحية الوصول لهذه الصفحة');
};

// مسارات تسجيل الدخول
app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE (username = ? AND password = ?) OR (role = 'admin' AND password = ? AND ? = '')", 
    [username, password, password, username || ''], (err, user) => {
        if (user) {
            req.session.user = user;
            res.redirect('/');
        } else {
            res.render('login', { error: 'اسم المستخدم أو كلمة السر غير صحيحة!' });
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// الداشبورد
app.get('/', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM purchases", (err, purchases) => {
        db.all("SELECT * FROM sales", (err, sales) => {
            db.all("SELECT * FROM prep_orders WHERE status = 'pending'", (err, pendingPrep) => {
                const totalPurchases = purchases.reduce((sum, p) => sum + (p.quantity * p.price), 0);
                const totalSales = sales.reduce((sum, s) => sum + (s.quantity * s.price), 0);
                
                // حساب الربح والمخزون
                let stock = {};
                purchases.forEach(p => stock[p.product] = (stock[p.product] || 0) + p.quantity);
                sales.forEach(s => stock[s.product] = (stock[s.product] || 0) - s.quantity);
                
                const profit = totalSales - (sales.reduce((sum, s) => {
                    const pItem = purchases.find(p => p.product === s.product);
                    return sum + (s.quantity * (pItem ? pItem.price : 0));
                }, 0));

                db.get("SELECT currency FROM settings WHERE id = 1", (err, setting) => {
                    const currency = setting ? setting.currency : 'JOD';
                    const stats = {
                        totalPurchases: totalPurchases.toFixed(2),
                        totalSales: totalSales.toFixed(2),
                        profit: profit.toFixed(2),
                        lowStock: Object.keys(stock).filter(p => stock[p] < 5).length,
                        stockCount: Object.keys(stock).length,
                        recentSales: sales.slice(-5).reverse(),
                        pendingPrep: pendingPrep.length
                    };
                    res.render("index", { stats, user: req.session.user, currency });
                });
            });
        });
    });
});

// إدارة المستخدمين
app.get('/users', isAuthenticated, isAdmin, (req, res) => {
    db.all("SELECT * FROM users", (err, rows) => {
        res.render('users', { usersList: rows, user: req.session.user });
    });
});

app.post('/users/add', isAuthenticated, isAdmin, (req, res) => {
    const { username, password, name, role } = req.body;
    db.run("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)", [username, password, name, role], () => {
        res.redirect('/users');
    });
});

app.post('/users/delete', isAuthenticated, isAdmin, (req, res) => {
    const { id } = req.body;
    if (id == req.session.user.id) return res.json({ success: false, message: 'لا يمكنك حذف نفسك!' });
    db.run("DELETE FROM users WHERE id = ?", [id], () => {
        res.json({ success: true });
    });
});

// المواد الخام (Filament)
app.post("/filament/delete", isAuthenticated, (req, res) => {
    const { id } = req.body;
    db.run("DELETE FROM filament WHERE id = ?", [id], function(err) {
        if (err) {
            console.error("Error deleting filament:", err);
            return res.json({ success: false, message: 'خطأ في حذف المواد الخام' });
        }
        res.json({ success: true });
    });
});

app.get("/filament", isAuthenticated, (req, res) => {
    db.all("SELECT * FROM filament", (err, rows) => {
        res.render("filament", { filament: rows, user: req.session.user });
    });
});

app.post("/filament/add", isAuthenticated, (req, res) => {
    const { color, weight, material, quantity, price, date } = req.body;
    db.run("INSERT INTO filament (color, weight, material, quantity, price, date) VALUES (?, ?, ?, ?, ?, ?)", 
    [color, weight, material, quantity, price, date], () => {
        res.redirect("/filament");
    });
});

app.post("/filament/update", isAuthenticated, (req, res) => {
    const { id, field, value } = req.body;
    db.run(`UPDATE filament SET ${field} = ? WHERE id = ?`, [value, id], () => {
        res.json({ success: true });
    });
});

app.post("/filament/delete", isAuthenticated, (req, res) => {
    const { id } = req.body;
    db.run("DELETE FROM filament WHERE id = ?", [id], () => {
        res.json({ success: true });
    });
});

// الإعادات
app.get("/returns", isAuthenticated, (req, res) => {
    db.all("SELECT * FROM returns", (err, rows) => {
        res.render("returns", { returns: rows, user: req.session.user });
    });
});

app.post("/returns/add", isAuthenticated, (req, res) => {
    const { product, quantity, reason, date } = req.body;
    db.run("INSERT INTO returns (product, quantity, reason, date) VALUES (?, ?, ?, ?)", 
    [product, quantity, reason, date], () => {
        res.redirect("/returns");
    });
});

app.post("/returns/update-status", isAuthenticated, (req, res) => {
    const { id, status } = req.body;
    db.run("UPDATE returns SET status = ? WHERE id = ?", [status, id], () => {
        res.json({ success: true });
    });
});

// المشتريات
app.post('/purchases/delete', isAuthenticated, (req, res) => {
    const { id } = req.body;
    db.run("DELETE FROM purchases WHERE id = ?", [id], function(err) {
        if (err) {
            console.error("Error deleting purchase:", err);
            return res.json({ success: false, message: 'خطأ في حذف المشتريات' });
        }
        res.json({ success: true });
    });
});

app.get('/purchases', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM purchases", (err, rows) => {
        db.get("SELECT currency FROM settings WHERE id = 1", (err, setting) => {
            const currency = setting ? setting.currency : 'JOD';
            res.render('purchases', { purchases: rows, user: req.session.user, currency });
        });
    });
});

app.post('/purchases/add', isAuthenticated, (req, res) => {
    const { product, quantity, price, date } = req.body;
    db.run("INSERT INTO purchases (product, quantity, price, date) VALUES (?, ?, ?, ?)", [product, quantity, price, date], () => {
        res.redirect('/purchases');
    });
});

// المبيعات
app.post("/sales/delete", isAuthenticated, (req, res) => {
    const { id } = req.body;
    db.run("DELETE FROM sales WHERE id = ?", [id], function(err) {
        if (err) {
            console.error("Error deleting sale:", err);
            return res.json({ success: false, message: 'خطأ في حذف المبيعات' });
        }
        res.json({ success: true });
    });
});

app.get("/sales", isAuthenticated, (req, res) => {
    db.all("SELECT * FROM sales", (err, rows) => {
        db.get("SELECT currency FROM settings WHERE id = 1", (err, setting) => {
            const currency = setting ? setting.currency : 'JOD';
            res.render("sales", { sales: rows, user: req.session.user, currency });
        });
    });
});

app.post('/sales/add', isAuthenticated, (req, res) => {
    const { product, quantity, price, customerName, customerPhone, paymentMethod, date } = req.body;
    db.run("INSERT INTO sales (product, quantity, price, customerName, customerPhone, paymentMethod, date) VALUES (?, ?, ?, ?, ?, ?, ?)", 
    [product, quantity, price, customerName, customerPhone, paymentMethod, date], () => {
        res.redirect('/sales');
    });
});

// المخزون
app.get('/stock', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM purchases", (err, pRows) => {
        db.all("SELECT * FROM sales", (err, sRows) => {
            let stock = {};
            pRows.forEach(p => stock[p.product] = (stock[p.product] || 0) + p.quantity);
            sRows.forEach(s => stock[s.product] = (stock[s.product] || 0) - s.quantity);
            const stockList = Object.keys(stock).map(product => ({ product, quantity: stock[product] }));
            res.render('stock', { stock: stockList, user: req.session.user });
        });
    });
});

// الطباعة ثلاثية الأبعاد
app.get("/3d-printing", isAuthenticated, (req, res) => {
    res.render("3d-printing", { user: req.session.user });
});

// مداليات NFC
app.get("/nfc-medallions", isAuthenticated, (req, res) => {
    res.render("nfc-medallions", { user: req.session.user });
});

// الإعدادات
app.get("/settings", isAuthenticated, (req, res) => {

    db.get("SELECT * FROM settings WHERE id = 1", (err, settings) => {
        if (err) {
            console.error("Error fetching settings:", err);
            settings = {}; // Provide empty object on error
        } else if (!settings) {
            settings = {}; // Ensure settings is an object even if no row is found
        }
        
        res.render("settings", { user: req.session.user, settings });
    });
});

app.post("/settings/update", isAuthenticated, (req, res) => {
    const { companyName, companyAddress, companyPhone, companyEmail, defaultMaterial, printerSettings, nfcTagProvider, nfcProgrammingSoftware, currency } = req.body;
    db.run("UPDATE settings SET companyName = ?, companyAddress = ?, companyPhone = ?, companyEmail = ?, defaultMaterial = ?, printerSettings = ?, nfcTagProvider = ?, nfcProgrammingSoftware = ?, currency = ? WHERE id = 1", 
    [companyName, companyAddress, companyPhone, companyEmail, defaultMaterial, printerSettings, nfcTagProvider, nfcProgrammingSoftware, currency], (err) => {
        if (err) {
            console.error("Error updating settings:", err);
            return res.json({ success: false, message: "فشل تحديث الإعدادات" });
        }
        res.json({ success: true, message: "تم تحديث الإعدادات بنجاح" });
    });
});

// طلبات التحضير
app.get('/prep', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM prep_orders", (err, rows) => {
        res.render('prep', { prepOrders: rows, user: req.session.user });
    });
});

app.post('/prep/add', isAuthenticated, (req, res) => {
    const { product, quantity, note } = req.body;
    const date = new Date().toISOString().split('T')[0];
    db.run("INSERT INTO prep_orders (product, quantity, status, date, note) VALUES (?, ?, 'pending', ?, ?)", 
    [product, quantity, date, note], () => {
        res.redirect('/prep');
    });
});

app.post('/prep/update-status', isAuthenticated, (req, res) => {
    const { id, status } = req.body;
    db.run("UPDATE prep_orders SET status = ? WHERE id = ?", [status, id], () => {
        res.json({ success: true });
    });
});

// إدارة البطاقات الرقمية
app.get('/digital-cards', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM digital_cards ORDER BY created_at DESC", (err, rows) => {
        res.render('digital-cards/index', { cards: rows, user: req.session.user });
    });
});

app.get('/digital-cards/create', isAuthenticated, (req, res) => {
    res.render('digital-cards/create', { user: req.session.user });
});

app.post('/digital-cards/create', isAuthenticated, (req, res) => {
    const { slug, name, title, bio, phone, email, website, linkedin, instagram, twitter, template, theme_color } = req.body;
    db.run("INSERT INTO digital_cards (slug, name, title, bio, phone, email, website, linkedin, instagram, twitter, template, theme_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [slug, name, title, bio, phone, email, website, linkedin, instagram, twitter, template, theme_color], (err) => {
        if (err) {
            console.error("Error creating digital card:", err);
            return res.render('digital-cards/create', { error: 'الرابط المختصر (slug) مستخدم بالفعل، اختر واحداً آخر', user: req.session.user });
        }
        res.redirect('/digital-cards');
    });
});

app.get('/digital-cards/edit/:id', isAuthenticated, (req, res) => {
    db.get("SELECT * FROM digital_cards WHERE id = ?", [req.params.id], (err, card) => {
        if (!card) return res.redirect('/digital-cards');
        res.render('digital-cards/edit', { card, user: req.session.user });
    });
});

app.post('/digital-cards/edit/:id', isAuthenticated, (req, res) => {
    const { name, title, bio, phone, email, website, linkedin, instagram, twitter, template, theme_color } = req.body;
    db.run("UPDATE digital_cards SET name = ?, title = ?, bio = ?, phone = ?, email = ?, website = ?, linkedin = ?, instagram = ?, twitter = ?, template = ?, theme_color = ? WHERE id = ?",
    [name, title, bio, phone, email, website, linkedin, instagram, twitter, template, theme_color, req.params.id], () => {
        res.redirect('/digital-cards');
    });
});

app.post('/digital-cards/delete', isAuthenticated, (req, res) => {
    db.run("DELETE FROM digital_cards WHERE id = ?", [req.body.id], () => {
        res.json({ success: true });
    });
});

// عرض البطاقة للجمهور (بدون تسجيل دخول)
app.get('/c/:slug', (req, res) => {
    db.get("SELECT * FROM digital_cards WHERE slug = ?", [req.params.slug], (err, card) => {
        if (!card) return res.status(404).send('البطاقة غير موجودة');
        res.render(`digital-cards/templates/${card.template}`, { card, layout: false });
    });
});

// API للرسوم البيانية
app.get('/api/chart-data', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM purchases", (err, pRows) => {
        db.all("SELECT * FROM sales", (err, sRows) => {
            let stock = {};
            pRows.forEach(p => stock[p.product] = (stock[p.product] || 0) + p.quantity);
            sRows.forEach(s => stock[s.product] = (stock[s.product] || 0) - s.quantity);
            
            res.json({
                stockLabels: Object.keys(stock),
                stockValues: Object.values(stock),
                salesTotal: sRows.reduce((sum, s) => sum + (s.quantity * s.price), 0),
                purchasesTotal: pRows.reduce((sum, p) => sum + (p.quantity * p.price), 0)
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
