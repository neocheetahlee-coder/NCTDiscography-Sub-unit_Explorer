const express = require('express');
const path = require('path'); // <-- เพิ่มบรรทัดนี้เข้ามาเพื่อเรียกใช้ระบบค้นหาโฟลเดอร์
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // <-- แก้บรรทัดนี้ให้ระบุพาธแบบเต็ม

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
// DSA 2: SORTING ALGORITHMS
// ==========================================
// เขียน Insertion Sort เองเพื่อจัดเรียงเพลงตามชื่อเพลง (A-Z, Z-A) หรือวันที่วางจำหน่าย (ใหม่สุด, เก่าสุด)
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
        // ยิง API แยกตามยูนิต พร้อมบังคับค้นหาจากชื่อศิลปิน (attribute=artistTerm)
        // สำหรับ NCT WISH ให้ดึงจากทั้งสโตร์ไทย (TH) และญี่ปุ่น (JP) เพื่อให้ได้ผลงานครบทั้ง 2 ภาษา
        const [res127, resDream, resU, resWishTH, resWishJP] = await Promise.all([
            fetch('https://itunes.apple.com/search?term=nct+127&entity=song&attribute=artistTerm&limit=200&country=TH'),
            fetch('https://itunes.apple.com/search?term=nct+dream&entity=song&attribute=artistTerm&limit=200&country=TH'),
            fetch('https://itunes.apple.com/search?term=nct+u&entity=song&attribute=artistTerm&limit=200&country=TH'),
            fetch('https://itunes.apple.com/search?term=nct+wish&entity=song&attribute=artistTerm&limit=200&country=TH'),
            fetch('https://itunes.apple.com/search?term=nct+wish&entity=song&attribute=artistTerm&limit=200&country=JP')
        ]);
        
        const data127 = await res127.json();
        const dataDream = await resDream.json();
        const dataU = await resU.json();
        const dataWishTH = await resWishTH.json();
        const dataWishJP = await resWishJP.json();
        
        // นำข้อมูลทั้งหมดมารวมกัน
        const combinedResults = [
            ...data127.results, 
            ...dataDream.results, 
            ...dataU.results, 
            ...dataWishTH.results,
            ...dataWishJP.results
        ];
        
        // กรองเอาเฉพาะข้อมูลที่มีชื่อเพลงและอัลบั้มครบ
       // กรองเอาเฉพาะข้อมูลที่มีชื่อเพลงและอัลบั้มครบ และชื่อศิลปินต้องมีคำว่า NCT
         const validSongs = combinedResults.filter(item => item.trackName && item.collectionName && item.artistName.toUpperCase().includes('NCT'));
        
        // ลบข้อมูลที่ซ้ำกันออก (ใช้ trackId เป็นตัวกรองหลัก)
        allSongs = Array.from(new Map(validSongs.map(item => [item.trackId, item])).values());
        
        songDB.buildIndex(allSongs); 
        console.log(`✅ โหลดข้อมูลสำเร็จ (${allSongs.length} เพลง จาก 127, DREAM, U, WISH ทั้ง TH และ JP)`);
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
    module.exports = app;
});