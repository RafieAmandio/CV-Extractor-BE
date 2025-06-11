#!/usr/bin/env node

const mongoose = require('mongoose');
const Job = require('../models/job.model');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const jobDefinitions = [
  {
    title: "Admin Officer",
    company: "Company Name",
    description: "Sebagai Staf Administrasi, Anda akan menjadi penghubung utama yang memastikan semua proses administrasi perusahaan berjalan rapi, akurat, dan tepat waktu. Peran ini menuntut ketelitian tinggi, kemampuan organisasi yang baik, serta komunikasi efektif lintas departemen.",
    requirements: [
      "Pendidikan D3/S1 di bidang Administrasi, Manajemen, atau disiplin terkait",
      "Pengalaman di bidang administrasi menjadi nilai tambah",
      "Mahir menggunakan Microsoft Office (Word, Excel, PowerPoint)",
      "Teliti, terorganisir, dan memiliki keterampilan komunikasi lisan & tertulis yang baik",
      "Mampu bekerja secara mandiri maupun kolaboratif dalam tim"
    ],
    skills: [
      "Microsoft Office",
      "Word",
      "Excel", 
      "PowerPoint",
      "Komunikasi",
      "Organisasi",
      "Administrasi",
      "Dokumentasi"
    ],
    responsibilities: [
      "Mengelola, mengarsipkan, dan menjaga kerahasiaan seluruh dokumen administrasi perusahaan",
      "Menyusun laporan harian, mingguan, dan bulanan sesuai kebutuhan manajemen",
      "Mengatur jadwal rapat, agenda perusahaan, serta memastikan logistik rapat terpenuhi",
      "Berkoordinasi dengan berbagai tim untuk kelancaran operasional dan alur informasi",
      "Menginput, memperbarui, dan memverifikasi data di sistem administrasi agar selalu akurat",
      "Memberikan support administratif kepada tim maupun manajemen",
      "Menangani surat masuk/keluar serta mendistribusikan dokumen internal dan eksternal"
    ],
    jobType: "Full-time",
    industry: "Administration",
    experienceLevel: "Entry-level",
    educationLevel: "Associate",
    active: true
  },
  {
    title: "Administrator HR",
    company: "Company Name", 
    description: "Sebagai HR Administrator, Anda akan berperan penting dalam memastikan seluruh proses administrasi Sumber Daya Manusia (SDM) berjalan akurat, terstruktur, dan sesuai peraturan. Posisi ini membutuhkan ketelitian tinggi, pemahaman dasar regulasi ketenagakerjaan, serta kemampuan berkoordinasi lintas fungsi.",
    requirements: [
      "Pendidikan D3/S1 di bidang Administrasi, Manajemen SDM, Psikologi, atau bidang relevan",
      "Pengalaman administrasi HR minimal 1 tahun (diutamakan)",
      "Mampu mengoperasikan Microsoft Office dan sistem HRIS/Payroll",
      "Teliti, terorganisir, serta memiliki keterampilan komunikasi yang baik",
      "Memahami dasar UU Ketenagakerjaan Indonesia dan praktik HR",
      "Mampu bekerja mandiri maupun kolaboratif dalam tim"
    ],
    skills: [
      "Microsoft Office",
      "HRIS",
      "Payroll System",
      "UU Ketenagakerjaan",
      "Administrasi HR",
      "Komunikasi",
      "Rekrutmen",
      "Employee Relations"
    ],
    responsibilities: [
      "Memelihara dan memperbarui database karyawan (HRIS) mencakup data pribadi, riwayat jabatan, dan dokumen kepersonaliaan",
      "Menyiapkan dokumen penawaran kerja, kontrak, orientasi karyawan baru, hingga proses administrasi keluar",
      "Mengumpulkan data absensi, lembur, dan perubahan gaji; berkoordinasi dengan tim payroll",
      "Mengelola administrasi tunjangan (BPJS Kesehatan/Ketenagakerjaan, asuransi, dll.)",
      "Menjadwalkan wawancara, mengelola korespondensi kandidat, dan menyusun laporan status rekrutmen",
      "Memastikan dokumen dan proses HR sejalan dengan regulasi ketenagakerjaan serta kebijakan internal",
      "Menyusun laporan absensi, turnover, dan statistik HR lainnya untuk kebutuhan manajemen",
      "Menyiapkan surat keputusan (SK), memo, dan pemberitahuan resmi terkait kepegawaian"
    ],
    jobType: "Full-time",
    industry: "Human Resources",
    experienceLevel: "Entry-level", 
    educationLevel: "Associate",
    active: true
  },
  {
    title: "Customer Service",
    company: "Company Name",
    description: "Sebagai Customer Service di perusahaan logistik, Anda akan menjadi garda terdepan dalam memberikan informasi, solusi, dan pengalaman positif bagi pelanggan. Anda menangani pertanyaan seputar pengiriman, melacak status barang, dan berkoordinasi dengan tim operasional untuk memastikan layanan tepat waktu dan bebas kendala.",
    requirements: [
      "D3/S1 di bidang Komunikasi, Manajemen, Logistik, atau disiplin terkait",
      "Pengalaman 1–2 tahun di layanan pelanggan; pengalaman sektor logistik/ekspedisi menjadi nilai plus",
      "Mampu menggunakan sistem CRM dan aplikasi pelacakan pengiriman (TMS/WMS)",
      "Keterampilan komunikasi lisan & tertulis yang jelas, sopan, dan persuasif",
      "Terbiasa bekerja dengan target SLA dan multitasking dalam lingkungan dinamis",
      "Nilai tambah: memahami istilah incoterms, proses custom clearance, atau peraturan pengiriman barang berbahaya (DG)"
    ],
    skills: [
      "Customer Service",
      "CRM System",
      "TMS",
      "WMS", 
      "Komunikasi",
      "Problem Solving",
      "Logistik",
      "Tracking System",
      "SLA Management",
      "Multitasking"
    ],
    responsibilities: [
      "Menjawab pertanyaan pelanggan melalui telepon, email, chat, atau media sosial terkait tarif, jadwal pengiriman, dan prosedur impor/ekspor",
      "Menangani keluhan (delay, kerusakan, salah alamat) dengan empati dan solusi cepat",
      "Memantau status kiriman di sistem TMS/WMS; memberikan update proaktif jika terjadi keterlambatan atau perubahan rute",
      "Berkomunikasi dengan tim pergudangan, armada, dan bea cukai untuk menyelesaikan masalah on-time delivery",
      "Membuat tiket kasus, mencatat kronologi, dan memastikan SLA terpenuhi sesuai SOP layanan pelanggan",
      "Menyusun laporan harian/mingguan tentang volume panggilan, jenis masalah, dan tingkat kepuasan pelanggan",
      "Menjelaskan persyaratan dokumen, asuransi kargo, dan opsi layanan kepada pelanggan",
      "Mengidentifikasi pola masalah berulang, memberikan masukan kepada manajemen untuk optimalisasi proses"
    ],
    jobType: "Full-time",
    industry: "Logistics",
    experienceLevel: "Entry-level",
    educationLevel: "Associate",
    active: true
  },
  {
    title: "Data Analyst", 
    company: "Company Name",
    description: "Sebagai Data Analyst, Anda akan bertanggung jawab mengubah data mentah menjadi insight yang dapat ditindaklanjuti, membantu tim manajemen membuat keputusan yang lebih tepat dan berbasis bukti. Posisi ini menuntut kemampuan analisis kuantitatif yang kuat, pemahaman bisnis, serta kemampuan menyajikan temuan secara jelas.",
    requirements: [
      "Pendidikan S1 di bidang Statistika, Matematika, Ilmu Komputer, Teknik Industri, atau disiplin terkait",
      "Pengalaman 1–2 tahun sebagai Data/Business Analyst (fresh graduate dipertimbangkan jika portofolio kuat)",
      "Mahir SQL serta Excel/Google Sheets tingkat lanjut",
      "Pengalaman dengan Python (pandas, numpy, matplotlib) atau R menjadi nilai tambah",
      "Familiar dengan salah satu alat Business Intelligence (Power BI, Tableau, Looker, Metabase, dll.)",
      "Memahami konsep statistik dasar (A/B testing, regresi, korelasi) dan praktik data governance",
      "Keterampilan komunikasi lisan & tertulis yang baik, mampu menyampaikan insight kepada audiens non-teknis"
    ],
    skills: [
      "SQL",
      "Excel",
      "Python",
      "Pandas",
      "NumPy",
      "Matplotlib",
      "R",
      "Power BI",
      "Tableau",
      "Looker",
      "Statistics",
      "Data Visualization",
      "A/B Testing"
    ],
    responsibilities: [
      "Menarik data dari berbagai sumber (database, API, spreadsheet) dan melakukan data wrangling",
      "Melakukan analisis statistik, eksplorasi pola, dan segmentasi untuk menjawab pertanyaan bisnis",
      "Membuat model prediktif sederhana (regresi, klasifikasi, time-series) sesuai kebutuhan",
      "Membangun dashboard interaktif di Power BI / Tableau / Looker",
      "Menyusun laporan rutin (mingguan/bulanan) dan ad-hoc dalam format yang mudah dipahami",
      "Menerjemahkan temuan data menjadi rekomendasi strategis bagi manajemen dan tim operasional",
      "Bekerja sama dengan produk, pemasaran, operasional, dan TI untuk mengidentifikasi kebutuhan data",
      "Membuat dokumentasi proses ETL, definisi metrik, dan panduan penggunaan dashboard"
    ],
    jobType: "Full-time",
    industry: "Technology",
    experienceLevel: "Entry-level",
    educationLevel: "Bachelor",
    active: true
  },
  {
    title: "Frontend Engineer",
    company: "Company Name",
    description: "Sebagai Junior Front-End Engineer, Anda akan membangun antarmuka web yang menarik, responsif, dan mudah digunakan. Bekerja sama dengan desainer UI/UX serta tim back-end, Anda menerjemahkan desain dan kebutuhan bisnis menjadi pengalaman digital yang mulus bagi pengguna.",
    requirements: [
      "S1 Ilmu Komputer, Teknik Informatika, atau bidang terkait (fresh graduate dipersilakan melamar)",
      "Pengalaman 0-2 tahun mengembangkan aplikasi web front-end (magang/proyek kampus dihitung)",
      "Menguasai HTML, CSS (Flexbox, Grid), JavaScript ES6+",
      "Familiar dengan satu framework modern (React diutamakan)",
      "Terbiasa menggunakan Git dan workflow pull request",
      "Memahami konsep dasar responsive design, cross-browser compatibility, dan web performance",
      "Nilai tambah: TypeScript, Sass/Less, Tailwind CSS, Figma, atau CI/CD (GitHub Actions, Vercel)"
    ],
    skills: [
      "HTML5",
      "CSS3", 
      "JavaScript",
      "React",
      "Vue.js",
      "Next.js",
      "TypeScript",
      "Git",
      "Responsive Design",
      "REST API",
      "GraphQL",
      "Tailwind CSS",
      "Sass",
      "Jest",
      "Cypress"
    ],
    responsibilities: [
      "Membangun dan memelihara halaman web menggunakan HTML5, CSS3, dan JavaScript modern",
      "Mengimplementasikan komponen reusable di React, Vue, atau Next.js",
      "Mengonsumsi REST/GraphQL API, memastikan data ditampilkan akurat dan real-time",
      "Memastikan kecepatan muat, aksesibilitas (WCAG), dan responsivitas di berbagai perangkat",
      "Menulis unit/functional test (Jest, React Testing Library, Cypress) dan melakukan debugging lintas-browser",
      "Berkoordinasi dengan desainer, back-end, dan QA melalui Agile/Scrum; aktif dalam code review di Git",
      "Menulis dokumentasi kode dan panduan penggunaan komponen untuk pengembang lain"
    ],
    jobType: "Full-time",
    industry: "Technology",
    experienceLevel: "Entry-level",
    educationLevel: "Bachelor", 
    active: true
  },
  {
    title: "Operator Data Entry",
    company: "Company Name",
    description: "Sebagai Operator Data Entry, Anda bertanggung jawab memasukkan, memverifikasi, dan memperbarui data ke dalam sistem perusahaan secara akurat dan tepat waktu. Peran ini krusial untuk menjaga kualitas informasi yang menjadi dasar pengambilan keputusan bisnis.",
    requirements: [
      "Pendidikan SMA/SMK (D3 di bidang Administrasi/Manajemen menjadi nilai tambah)",
      "Pengalaman 0–1 tahun sebagai data entry/operator administrasi (fresh graduate dipersilakan)",
      "Kecepatan mengetik minimal 45 WPM dengan tingkat akurasi tinggi",
      "Mahir Microsoft Excel (fungsi dasar, filter, sort) dan familiar dengan sistem database",
      "Teliti, disiplin, serta terbiasa bekerja dengan tugas repetitif",
      "Mampu bekerja di bawah tekanan dan fleksibel terhadap penjadwalan shift bila diperlukan",
      "Berdomisili di Jabodetabek atau bersedia untuk pindah"
    ],
    skills: [
      "Data Entry",
      "Microsoft Excel",
      "Database",
      "Typing Speed",
      "Accuracy",
      "Attention to Detail",
      "Document Management",
      "Quality Control"
    ],
    responsibilities: [
      "Memasukkan data transaksi, inventaris, atau dokumen lain ke dalam database/ERP",
      "Memeriksa keakuratan data yang diterima, mengidentifikasi kesalahan, dan melakukan koreksi",
      "Memindai, mengunggah, dan mengorganisir dokumen agar mudah diakses dan terjaga kerahasiaannya",
      "Menghasilkan laporan harian/mingguan tentang progres input dan ketepatan data",
      "Berkomunikasi dengan divisi terkait (administrasi, gudang, keuangan) untuk mendapatkan data terbaru",
      "Mematuhi standar operasional dan kebijakan keamanan data perusahaan",
      "Menyelesaikan volume input sesuai SLA (Service Level Agreement) dan tenggat waktu"
    ],
    jobType: "Full-time",
    industry: "Administration",
    experienceLevel: "Entry-level",
    educationLevel: "High School",
    active: true
  },
  {
    title: "Product Manager", 
    company: "Company Name",
    description: "Sebagai Product Manager, Anda akan memimpin siklus hidup produk end-to-end—mulai dari ideasi, validasi pasar, pengembangan, hingga peluncuran dan optimalisasi. Anda bertindak sebagai 'jembatan' antara bisnis, desain, dan teknologi, memastikan visi produk selaras dengan kebutuhan pengguna dan strategi perusahaan.",
    requirements: [
      "S1 di bidang Teknik, Ilmu Komputer, Manajemen Bisnis, atau disiplin terkait",
      "3–5 tahun pengalaman di product management (pengalaman startup/tech company diutamakan)",
      "Terbukti sukses meluncurkan produk digital dan mencapai target KPI",
      "Mahir menggunakan tool Agile & produktivitas (Jira, Trello, Notion) serta analitik produk",
      "Memahami konsep UX, desain thinking, dan lean startup",
      "Keterampilan komunikasi & negosiasi yang kuat dalam bahasa Indonesia dan Inggris",
      "Nilai tambah: pengalaman dengan OKR framework, SQL dasar, atau sertifikasi (PMC, CSPO, Pragmatic Institute)"
    ],
    skills: [
      "Product Management",
      "Agile",
      "Scrum",
      "Jira",
      "Trello",
      "Notion",
      "Google Analytics",
      "Mixpanel",
      "UX Design",
      "Design Thinking",
      "Lean Startup",
      "KPI Analysis",
      "A/B Testing",
      "SQL",
      "OKR"
    ],
    responsibilities: [
      "Menyusun visi, nilai jual unik, dan peta jalan (roadmap) produk berdasarkan riset pasar dan tujuan bisnis",
      "Melakukan riset kuantitatif dan kualitatif (user interview, survey, competitive analysis)",
      "Mengelola backlog dengan kerangka prioritisasi (RICE, MoSCoW) demi memaksimalkan dampak bisnis",
      "Berkolaborasi erat dengan tim engineering, desain UX/UI, dan QA menggunakan metodologi Agile/Scrum",
      "Mengoordinasikan strategi peluncuran (beta, rollout bertahap) bersama marketing, sales, dan customer success",
      "Menetapkan KPI (retention, conversion, NPS, ARR), memantau performa, dan menjalankan eksperimen A/B",
      "Mengkomunikasikan status produk, risiko, dan insight kepada manajemen eksekutif",
      "Menjaga dokumen PRD, flowchart, dan guideline produk; memastikan kepatuhan terhadap regulasi"
    ],
    jobType: "Full-time",
    industry: "Technology",
    experienceLevel: "Mid-level",
    educationLevel: "Bachelor",
    active: true
  },
  {
    title: "Staff IT",
    company: "Company Name", 
    description: "Sebagai Staff IT, Anda akan memastikan infrastruktur teknologi informasi perusahaan berjalan stabil, aman, dan efisien. Anda akan menangani dukungan harian untuk pengguna, pemeliharaan jaringan & perangkat keras, serta berkontribusi pada implementasi proyek IT baru.",
    requirements: [
      "D3/S1 Teknik Informatika, Ilmu Komputer, Sistem Informasi, atau bidang relevan",
      "Pengalaman 1–2 tahun di dukungan IT/infrastruktur (fresh graduate dipertimbangkan jika memiliki proyek/organisasi IT)",
      "Menguasai Windows & macOS troubleshooting, instalasi software, dan basic networking (TCP/IP, DHCP, VLAN)",
      "Familiar dengan Active Directory/Entra ID, Office 365/Google Workspace, dan konsep virtualisasi",
      "Nilai tambah: kemampuan basic scripting (PowerShell/Bash), monitoring (Zabbix/Prometheus), atau cloud (AWS/Azure)",
      "Teliti, mampu bekerja berdasarkan SLA, dan siap menangani beberapa tugas sekaligus (multi-tasking)"
    ],
    skills: [
      "Windows Administration",
      "macOS", 
      "Networking",
      "TCP/IP",
      "DHCP", 
      "VLAN",
      "Active Directory",
      "Office 365",
      "Google Workspace",
      "VMware",
      "Hyper-V",
      "PowerShell",
      "Bash",
      "Help Desk",
      "Hardware Troubleshooting"
    ],
    responsibilities: [
      "Menangani tiket/permintaan terkait PC, printer, software, jaringan, dan akun pengguna",
      "Melakukan instalasi, konfigurasi, patching, dan troubleshooting pada laptop/desktop, server, serta perangkat jaringan",
      "Memantau ketersediaan dan performa LAN/WAN, Wi-Fi, firewall, dan switch; melakukan perbaikan saat terjadi gangguan",
      "Menegakkan kebijakan keamanan (antivirus, backup, kontrol akses), serta mendukung audit dan remediasi kerentanan",
      "Memelihara spreadsheet/asset management system untuk lisensi software dan perangkat IT; membuat SOP & laporan insiden",
      "Membantu tim infrastruktur/aplikasi dalam roll-out sistem baru, migrasi data, atau upgrade hardware",
      "Memberikan panduan singkat atau workshop mengenai best practice keamanan, aplikasi baru, dan pemanfaatan teknologi"
    ],
    jobType: "Full-time", 
    industry: "Technology",
    experienceLevel: "Entry-level",
    educationLevel: "Associate",
    active: true
  }
];

async function insertJobs() {
  try {
    console.log(`${colors.blue}🔗 Connecting to MongoDB...${colors.reset}`);
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`${colors.green}✅ Connected to MongoDB${colors.reset}`);

    console.log(`${colors.yellow}📝 Preparing to insert ${jobDefinitions.length} job definitions...${colors.reset}`);

    // Clear existing jobs (optional)
    const existingCount = await Job.countDocuments();
    console.log(`${colors.cyan}📊 Found ${existingCount} existing jobs in database${colors.reset}`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const jobDef of jobDefinitions) {
      try {
        // Check if job already exists
        const existingJob = await Job.findOne({ 
          title: jobDef.title,
          company: jobDef.company 
        });

        if (existingJob) {
          console.log(`${colors.yellow}⚠️  Job "${jobDef.title}" already exists, skipping...${colors.reset}`);
          skippedCount++;
          continue;
        }

        // Add raw description for full text
        const rawDescription = `${jobDef.description}\n\nTanggung Jawab:\n${jobDef.responsibilities.join('\n')}\n\nKualifikasi:\n${jobDef.requirements.join('\n')}\n\nSkills:\n${jobDef.skills.join(', ')}`;
        
        const job = new Job({
          ...jobDef,
          rawDescription,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await job.save();
        console.log(`${colors.green}✅ Inserted: ${jobDef.title}${colors.reset}`);
        insertedCount++;

      } catch (error) {
        console.log(`${colors.red}❌ Failed to insert "${jobDef.title}": ${error.message}${colors.reset}`);
      }
    }

    console.log(`\n${colors.cyan}📊 SUMMARY:${colors.reset}`);
    console.log(`${colors.green}✅ Successfully inserted: ${insertedCount} jobs${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Skipped (already exists): ${skippedCount} jobs${colors.reset}`);
    console.log(`${colors.blue}📈 Total jobs in database: ${await Job.countDocuments()}${colors.reset}`);

    console.log(`\n${colors.green}🎉 Job insertion completed successfully!${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log(`${colors.blue}🔌 Disconnected from MongoDB${colors.reset}`);
  }
}

// Run the script
if (require.main === module) {
  insertJobs();
}

module.exports = { insertJobs, jobDefinitions }; 