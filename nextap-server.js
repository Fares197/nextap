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

    // إضافة مستخدم افتراضي إذا لم يوجد
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (username, password, role, name) VALUES ('admin', 'FARES HTS 2020', 'admin', 'فارس (المدير)')");
        }
    });
});

app.set('view engine', 'ejs');
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

                const stats = {
                    totalPurchases: totalPurchases.toFixed(2),
                    totalSales: totalSales.toFixed(2),
                    profit: profit.toFixed(2),
                    lowStock: Object.keys(stock).filter(p => stock[p] < 5).length,
                    stockCount: Object.keys(stock).length,
                    recentSales: sales.slice(-5).reverse(),
                    pendingPrep: pendingPrep.length
                };
                res.render('index', { stats, user: req.session.user });
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

// المشتريات
app.get('/purchases', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM purchases", (err, rows) => {
        res.render('purchases', { purchases: rows, user: req.session.user });
    });
});

app.post('/purchases/add', isAuthenticated, (req, res) => {
    const { product, quantity, price, date } = req.body;
    db.run("INSERT INTO purchases (product, quantity, price, date) VALUES (?, ?, ?, ?)", [product, quantity, price, date], () => {
        res.redirect('/purchases');
    });
});

// المبيعات
app.get('/sales', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM sales", (err, rows) => {
        res.render('sales', { sales: rows, user: req.session.user });
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
