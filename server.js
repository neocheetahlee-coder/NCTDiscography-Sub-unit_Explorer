const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public')); // ให้บริการไฟล์หน้าเว็บจากโฟลเดอร์ public

const API_URL = 'https://itunes.apple.com/search?term=nct&entity=song&limit=200';
let allSongs = [];

// ==========================================
// DSA 1: HASH TABLE (สำหรับระบบค้นหา)
// ==========================================
class SearchHashTable {
    constructor() {
        this.table = {}; // ใช้ Object เป็น Hash Table
    }

    // ฟังก์ชันสร้าง Index ข้อมูล (แยกคำจากชื่อเพลง, อัลบั้ม, ศิลปิน)
    buildIndex(songs) {
        this.table = {}; 
        songs.forEach(song => {
            // จับเอาคำทั้งหมดมาแยกด้วยช่องว่าง และทำให้เป็นตัวพิมพ์เล็ก
            const words = `${song.trackName} ${song.collectionName} ${song.artistName}`.toLowerCase().split(/\s+/);
            words.forEach(word => {
                if (!this.table[word]) {
                    this.table[word] = [];
                }
                // ถ้ายังไม่มีเพลงนี้ใน array ของคำนั้น ให้เพิ่มเข้าไป
                if (!this.table[word].some(s => s.trackId === song.trackId)) {
                    this.table[word].push(song);
                }
            });
        });
    }

    // ฟังก์ชันค้นหา O(1) - O(n)
    search(keyword) {
        const key = keyword.toLowerCase().trim();
        // กรณีพิมพ์คำเป๊ะๆ (O(1))
        if (this.table[key]) return this.table[key];
        
        // กรณีพิมพ์แค่บางส่วน (ต้องวนลูปหา)
        let results = [];
        for (let hashKey in this.table) {
            if (hashKey.includes(key)) {
                results.push(...this.table[hashKey]);
            }
        }
        // ลบข้อมูลซ้ำ
        return [...new Map(results.map(item => [item.trackId, item])).values()];
    }
}
const songDB = new SearchHashTable();

// ==========================================
// DSA 2: MANUAL SORTING ALGORITHMS
// ==========================================
// เขียน Insertion Sort ขึ้นมาเองตามกติกา
function customSort(arr, type) {
    let result = [...arr];
    for (let i = 1; i < result.length; i++) {
        let current = result[i];
        let j = i - 1;

        if (type === 'az') {
            while (j >= 0 && result[j].trackName.localeCompare(current.trackName) > 0) {
                result[j + 1] = result[j];
                j--;
            }
        } else if (type === 'za') {
            while (j >= 0 && result[j].trackName.localeCompare(current.trackName) < 0) {
                result[j + 1] = result[j];
                j--;
            }
        } else if (type === 'newest') {
            while (j >= 0 && new Date(result[j].releaseDate) < new Date(current.releaseDate)) {
                result[j + 1] = result[j];
                j--;
            }
        } else if (type === 'oldest') {
            while (j >= 0 && new Date(result[j].releaseDate) > new Date(current.releaseDate)) {
                result[j + 1] = result[j];
                j--;
            }
        }
        result[j + 1] = current;
    }
    return result;
}

// ==========================================
// ดึงข้อมูลและจัดการ Routing
// ==========================================
async function fetchAppleMusicData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        // กรองเอาเฉพาะข้อมูลที่มีฟิลด์ครบ
        allSongs = data.results.filter(item => item.trackName && item.collectionName);
        songDB.buildIndex(allSongs); // นำข้อมูลไปสร้าง Hash Table
        console.log(`✅ โหลดข้อมูลและสร้าง Hash Table สำเร็จ (${allSongs.length} เพลง)`);
    } catch (error) {
        console.error("API Error:", error);
    }
}

// Endpoint ดึงข้อมูล (รองรับการค้นหา จัดเรียง และกรองยูนิต)
app.get('/api/songs', (req, res) => {
    const { unit, sort, search } = req.query;
    let results = allSongs;

    // 1. ค้นหาด้วย Hash Table
    if (search) {
        results = songDB.search(search);
    }

    // 2. กรองตาม Unit
    if (unit && unit !== 'ALL') {
        results = results.filter(song => song.artistName.toUpperCase().includes(unit.toUpperCase()));
    }

    // 3. จัดเรียงด้วยลอจิกที่เขียนเอง (Sorting)
    if (sort) {
        results = customSort(results, sort);
    }

    // จำลองระบบ Top 3 (จำลองโดยการเอา 3 อันดับแรกของผลลัพธ์)
    const top3 = results.slice(0, 3);

    res.json({ top3, songs: results });
});

// เริ่มเซิร์ฟเวอร์
fetchAppleMusicData().then(() => {
    app.listen(PORT, () => console.log(`🚀 พร้อมใช้งานที่ http://localhost:${PORT}`));
});