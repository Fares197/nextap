# دليل نشر تطبيق Nextap بشكل دائم

يهدف هذا الدليل إلى توفير إرشادات مفصلة لنشر تطبيق Nextap، المبني باستخدام Node.js و Express وقاعدة بيانات SQLite، ليعمل بشكل دائم ومستقر. سنغطي خيارين رئيسيين: النشر على منصة Render (للسهولة والسرعة) والنشر على خادم افتراضي خاص (VPS) مثل DigitalOcean أو Hetzner (لتحكم أكبر).

## 1. النشر على Render (الخيار الموصى به للمبتدئين)

[Render](https://render.com/) هي منصة سحابية تتيح نشر التطبيقات بسهولة من مستودعات GitHub. توفر Render خطة مجانية لمشاريع الويب، ولكن يجب الانتباه إلى أن قواعد بيانات SQLite قد لا تكون دائمة بشكل افتراضي.

### المتطلبات المسبقة:
*   حساب GitHub مع مستودع `nextap`.
*   حساب Render.

### خطوات النشر:
1.  **إنشاء خدمة ويب جديدة على Render:**
    *   سجل الدخول إلى حسابك في Render.
    *   انقر على "New" ثم اختر "Web Service".
    *   اربط حسابك في GitHub واختر مستودع `nextap`.
    *   قم بتكوين الإعدادات الأساسية:
        *   **Name:** `nextap-app` (أو أي اسم تفضله)
        *   **Region:** اختر أقرب منطقة جغرافية لجمهورك.
        *   **Branch:** `main` (أو الفرع الذي يحتوي على الكود الخاص بك)
        *   **Root Directory:** `/` (إذا كان `nextap-server.js` في الجذر)
        *   **Runtime:** `Node`
        *   **Build Command:** `npm install`
        *   **Start Command:** `node nextap-server.js`
2.  **إعداد متغيرات البيئة (Environment Variables):**
    *   في قسم "Environment"، أضف المتغيرات التالية:
        *   `PORT`: `10000` (Render تستخدم هذا المنفذ لتطبيقات Node.js)
        *   `SESSION_SECRET`: `your_super_secret_key_here` (استبدلها بسلسلة عشوائية قوية)
3.  **تكوين "Persistent Disk" لقاعدة بيانات SQLite (هام جداً):**
    *   لضمان بقاء بياناتك في `database.sqlite`، يجب إعداد "Persistent Disk".
    *   في صفحة إعدادات خدمة الويب الخاصة بك على Render، انتقل إلى قسم "Disks".
    *   انقر على "Add Disk".
    *   **Name:** `nextap-data` (أو أي اسم تفضله)
    *   **Mount Path:** `/var/data` (هذا هو المسار الذي سيتم فيه تخزين ملف قاعدة البيانات على Render)
    *   **ملاحظة:** ستحتاج إلى تعديل `nextap-server.js` لتخزين `database.sqlite` في هذا المسار. ابحث عن السطر `const dbPath = path.join(__dirname, 'database.sqlite');` وقم بتعديله ليصبح `const dbPath = path.join('/var/data', 'database.sqlite');`.
4.  **النشر (Deploy):**
    *   انقر على "Create Web Service". ستقوم Render تلقائياً بسحب الكود، تثبيت التبعيات، وتشغيل التطبيق.
    *   راقب سجلات النشر للتأكد من عدم وجود أخطاء.
5.  **الوصول إلى التطبيق:**
    *   بعد نجاح النشر، ستوفر لك Render رابطاً عاماً لتطبيقك (مثال: `https://nextap-app.onrender.com`).

## 2. النشر على خادم افتراضي خاص (VPS) - مثل DigitalOcean أو Hetzner

يوفر لك الخادم الافتراضي الخاص تحكماً كاملاً بالبيئة، وهو مناسب للمشاريع التي تتطلب تخصيصاً أكبر أو موارد أعلى.

### المتطلبات المسبقة:
*   خادم VPS (مثال: Ubuntu 22.04).
*   وصول SSH إلى الخادم.
*   اسم نطاق (Domain Name) خاص بك (اختياري ولكن موصى به).

### خطوات النشر:
1.  **الاتصال بالخادم وتحديثه:**
    ```bash
    ssh user@your_vps_ip_address
    sudo apt update && sudo apt upgrade -y
    ```
2.  **تثبيت Node.js و npm:**
    ```bash
    sudo apt install nodejs npm -y
    ```
3.  **استنساخ المشروع من GitHub:**
    ```bash
    git clone https://github.com/Fares197/nextap.git /var/www/nextap
    cd /var/www/nextap
    npm install
    ```
4.  **إنشاء ملف متغيرات البيئة (`.env`):**
    ```bash
    nano .env
    ```
    أضف المحتوى التالي (استبدل `your_super_secret_key_here` بقيمة قوية):
    ```
    PORT=3000
    SESSION_SECRET=your_super_secret_key_here
    ```
    احفظ الملف واخرج (Ctrl+X, Y, Enter).
5.  **تثبيت PM2 لإدارة العمليات:**
    PM2 هو مدير عمليات لـ Node.js يضمن بقاء تطبيقك قيد التشغيل وإعادة تشغيله تلقائياً عند الأعطال.
    ```bash
    sudo npm install -g pm2
    pm2 start nextap-server.js --name nextap-app
    pm2 startup systemd
    sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u your_username --hp /home/your_username
    pm2 save
    ```
    *ملاحظة: استبدل `your_username` باسم المستخدم الخاص بك على الخادم.* 
6.  **تثبيت Nginx كوكيل عكسي (Reverse Proxy):**
    Nginx سيوجه طلبات الويب إلى تطبيق Node.js الخاص بك الذي يعمل على المنفذ 3000.
    ```bash
    sudo apt install nginx -y
    sudo nano /etc/nginx/sites-available/nextap
    ```
    أضف التكوين التالي (استبدل `your_domain.com` باسم نطاقك أو عنوان IP الخاص بالخادم):
    ```nginx
    server {
        listen 80;
        server_name your_domain.com www.your_domain.com;

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
    احفظ الملف واخرج.
    ```bash
    sudo ln -s /etc/nginx/sites-available/nextap /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    ```
7.  **تأمين الموقع بشهادة SSL (HTTPS) باستخدام Certbot (موصى به):**
    ```bash
    sudo snap install core
    sudo snap refresh core
    sudo snap install --classic certbot
    sudo ln -s /snap/bin/certbot /usr/bin/certbot
    sudo certbot --nginx -d your_domain.com -d www.your_domain.com
    ```
    اتبع التعليمات على الشاشة.

### 3. إعداد نظام النسخ الاحتياطي لقاعدة بيانات SQLite

لقد قمت بإنشاء سكريبت نسخ احتياطي تلقائي لقاعدة البيانات. لجدولته للتشغيل اليومي، يمكنك استخدام `cron`.

1.  **فتح محرر Cron:**
    ```bash
    crontab -e
    ```
2.  **إضافة مهمة Cron:**
    أضف السطر التالي في نهاية الملف لحفظ نسخة احتياطية كل يوم في منتصف الليل (00:00):
    ```
    0 0 * * * /bin/bash /var/www/nextap/backup_db.sh >> /var/www/nextap/backup.log 2>&1
    ```
    *ملاحظة: تأكد من أن المسار `/var/www/nextap/backup_db.sh` صحيح.* 

## 4. تحديث الكود في المستقبل

لتحديث تطبيقك بعد إجراء تغييرات على GitHub:

1.  **إذا كنت تستخدم Render:**
    *   يمكنك إعداد "Auto Deploy" في Render لسحب التغييرات تلقائياً عند كل `push` إلى الفرع الرئيسي.
    *   أو يمكنك النقر يدوياً على "Deploy" في لوحة تحكم Render.
2.  **إذا كنت تستخدم VPS:**
    ```bash
    cd /var/www/nextap
    git pull origin main
    npm install
    pm2 restart nextap-app
    ```

---
