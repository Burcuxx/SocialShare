# Social Share — Tasarım Spesifikasyonu

Bu dosya Claude Code için yazıldı. Kullanmak için Claude Code'a şunu yaz:

> `DESIGN.md` dosyasındaki tasarımı uygula. Mevcut işlevselliği (server action'lar, formlar, worker, API route'ları) değiştirme; sadece arayüzü ve stilleri güncelle. Yeni bağımlılık ekleme.

Görsel referans (canvas): https://claude.ai/artifact/Hc7ghpqtWdpJprp9VnUQSY

---

## Genel kurallar

- Sadece `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/videos/[id]/page.tsx` ve `upload-form.tsx` dosyalarına dokun. `src/lib/*`, `actions.ts` ve API route'ları aynen kalır.
- Tailwind veya UI kütüphanesi ekleme; düz CSS + CSS değişkenleri kullan.
- Arayüz dili Türkçe kalır. Mevcut metinleri (Yenile, Gönder, Tekrar dene, "Sadece ben" uyarısı vb.) koru.
- Uygulama telefondan da kullanılıyor: 390 px genişlikte yatay kaydırma olmamalı, tüm dokunma hedefleri en az 44 px.
- İkonlar inline SVG (stroke, 2 px, `currentColor`). Emoji kullanma.
- Erişilebilirlik: gerçek `<button>`, `<a>`, `<label>`; ikon-only butonlarda `aria-label`; metin kontrastı ≥ 4.5:1.

## Tipografi

`layout.tsx` içinde `next/font/google` ile yükle:

| Rol | Font | Kullanım |
|---|---|---|
| Başlık | **Bricolage Grotesque** 600/700 | h1 (40 px masaüstü / 28 px mobil, `letter-spacing: -0.02em`), h2 (22 px), logo |
| Gövde | **Geist** 400/500/600 | her şey |
| Rakam | **Geist Mono** 500 | süre (0:58), karakter sayacı (84 / 2200), yüzdeler |

## Renk token'ları (`globals.css`)

```css
:root {
  --ground: #F2F3EF;      /* sayfa zemini */
  --surface: #FFFFFF;     /* kartlar */
  --surface-2: #FAFAF8;   /* textarea, ikincil paneller */
  --ink: #17181C;         /* ana metin, sidebar zemini */
  --ink-2: #4A4D55;       /* ikincil metin */
  --line: #E2E3DE;        /* kart kenarı */
  --line-strong: #DADBD5; /* input kenarı */
  --primary: #4338CA;     /* ana buton, seçili kart kenarı, progress */
  --primary-ink: #3730A3; /* linkler */
  --highlight: #C8F169;   /* sidebar logo kutusu, kuyruk sayacı (koyu zemin üstünde) */

  /* durum çipleri: arka plan / yazı */
  --done-bg: #DCFCE7;    --done-fg: #166534;
  --failed-bg: #FEE2E2;  --failed-fg: #991B1B;
  --run-bg: #E0E7FF;     --run-fg: #3730A3;
  --wait-bg: #EDEEEA;    --wait-fg: #3F4249;

  /* platform işaretleri */
  --youtube: #DC2626;
  --tiktok: #17181C;
  --instagram: #A21CAF;
}
```

Koyu mod: `@media (prefers-color-scheme: dark)` içinde ground `#111214`, surface `#1A1B1F`, surface-2 `#202126`, ink `#F1F2EE`, ink-2 `#A9ABA4`, line `#2C2E34`, primary `#6366F1`. Sidebar koyu modda da `#0B0C0E` kalır.

Radius: kart 14–16 px, buton/input 10 px, çip 999 px. Gölge yok; ayrım kenarlık ve zemin farkıyla yapılır.

## Bileşenler

- **Buton (ikincil):** 44 px yükseklik, `surface` zemin, `line-strong` kenar, 500 ağırlık, solda ikon.
- **Buton (ana):** `primary` zemin, beyaz yazı, 48 px yükseklik, 600 ağırlık, sağda ok ikonu.
- **Durum çipi** (`.badge.<status>`): 12 px, 3×9 px padding. Eşleme:
  `pending` → wait "Sırada", `downloading`/`processing`/`uploading` → run, `done` → done "✓ …", `failed` → failed "Hata". Renk tek başına anlam taşımasın: metin her zaman platform adını ve durumu içerir (ör. "✓ TikTok", "Hata · TikTok").
- **Platform işareti:** 34–36 px kare, 9–10 px radius, platform renginde zemin, beyaz iki harfli kısaltma (Tk, Ig, Yt). Hesap listelerinde 7 px renkli nokta + platform adı.
- **Progress bar:** 6 px yükseklik, `wait-bg` iz, `primary` dolgu (hata: `#B91C1C`, bitti: `#15803D`).

## Ekran 1 — Video kütüphanesi (`src/app/page.tsx`)

Masaüstünde 3 kolonlu grid: `248px | 1fr | 320px`.

1. **Sol sidebar** (`ink` zemin, açık yazı)
   - Logo: `highlight` renkli 32 px kutu içinde sağ ok ikonu + "Social Share".
   - Menü: Videolar (aktif: `#26282E` zemin), Gönderim kuyruğu (aktif iş sayısı `highlight` rozetiyle), Hesaplar.
   - "Hesaplar" bölümü: her `account` için kart → ad + bağlı platform çipleri (renkli nokta). Altında kesik kenarlı "+ Hesap ekle" butonu; tıklayınca mevcut `createAccount` formu açılır (inline input + Ekle).
   - Bağlantı butonları (+ YouTube, + TikTok) hesap kartının içinde küçük ikincil buton olarak kalır.
2. **Orta alan**
   - Üstte küçük etiket ("Hesap · YouTube kanalı adı"), altında büyük "Videolar" başlığı. Sağda arama input'u (istemci tarafı başlık filtresi) ve "Yenile" butonu (mevcut `refreshVideos` formu).
   - Filtre çipleri: Tümü · N, Gönderilmedi · N, Gönderildi · N, Hata · N (sayılar mevcut `jobs` sorgusundan hesaplanır; filtre `?filter=` query param ile).
   - Birden fazla kanal varsa kanal adı küçük alt başlık olarak gruplar.
   - **Video kartı:** 16:9 thumbnail, sağ altta koyu yarı saydam kutuda Geist Mono süre; altta başlık (600, 15 px, 2 satır kırp), tarih (`ink-2`, 13 px), durum çipleri. Grid `repeat(auto-fill, minmax(220px, 1fr))`, gap 16 px. Hover'da kenar `ink-2`.
3. **Sağ panel — Kuyruk** (`surface-2` zemin, sol kenarlık)
   - Son işler (ör. son 8 `jobs` kaydı): platform noktası + adı, durum çipi, video başlığı, progress bar, adım metni ("İndir ✓ · Yükle", "Bekliyor", "3 deneme başarısız · Tekrar dene").
   - Çalışan iş varsa mevcut `AutoRefresh` bileşeni bu sayfada da kullanılır.

Responsive: ≤1100 px'te sağ panel gizlenir; ≤720 px'te sidebar gizlenir, yerine üstte logo + hamburger olmayan basit bir başlık çubuğu ve hesap seçici (`<select>`) gelir.

## Ekran 2 — Video gönder (`src/app/videos/[id]/page.tsx`)

- **Üst çubuk:** beyaz, alt kenarlık; solda "← Videolar" linki (44 px), ortada/sağda logo.
- **İçerik:** max 1160 px, 2 kolon `5fr | 7fr` (≤900 px'te tek kolon).
- **Sol kolon:**
  - 16 px radius büyük thumbnail + süre etiketi.
  - Başlık (Bricolage, 30 px), meta satırı: hesap · YouTube, tarih, süre.
  - "Gönderim adımları" kartı: 3 adımlı liste (YouTube'dan indir → Platformlara yükle → Tamamlandı · geçici dosya silinir). Adım dairesi: bitti = yeşil ✓, aktif = `primary` numara, bekleyen = gri kenarlı numara. Durumu en ileri işe göre hesapla.
  - `UploadForm` (indirme hatasında): kesik kenarlı kart, "İndirme başarısız olursa" başlığı, açıklama, "Video dosyası seç" butonu olarak stillenmiş `<label>` + gizli `input[type=file]`.
- **Sağ kolon — "Nereye gönderilsin?"** (sağda "N hedef seçili")
  - **Seçilebilir hedef kartı** (iş yoksa): checkbox (20 px, `accent-color: primary`) + platform işareti + platform adı + `@display_name`. Seçiliyken kart kenarı 2 px `primary`, değilse 1 px `line`. İçinde "Açıklama" etiketli textarea (`surface-2`), altında solda TikTok uyarısı (amber `#92400E` bilgi ikonu ile), sağda Geist Mono `uzunluk / 2200` sayacı (küçük bir client component).
  - **İşi olan hedef kartı:** sağ üstte durum çipi, işleniyorsa progress bar, hata varsa `#FEF2F2` zeminli hata kutusu + "Tekrar dene" ikincil butonu; bittiyse TikTok "Sadece ben" bilgisi.
- **Yapışkan alt çubuk** (`position: sticky; bottom: 0`, beyaz, üst kenarlık): solda seçili platform adları, sağda ana buton "Gönder · N platform". Mevcut `form#send` ve `sendVideo` aksiyonu korunur.

## Ekran 3 — Mobil (≤480 px)

- Üst çubuk: 44 px geri butonu (`aria-label="Videolara dön"`) + "Video gönder".
- Video özeti yatay: 112 px küçük thumbnail + başlık (19 px) + "Hesap · tarih".
- Hedef kartları aynı yapıda, checkbox sağda (başparmak erişimi). Textarea 3 satır, font 15 px.
- Alt çubuk ekrana sabit, tam genişlik 52 px ana buton, alt padding 28 px (iPhone home bar).
- Video kütüphanesi mobilde tek kolon kart listesi; kuyruk paneli yerine üstte "3 iş işleniyor" şeridi.

## Kabul kriterleri

- [ ] `npm run typecheck` ve `npm run build` geçiyor.
- [ ] Tüm mevcut akışlar çalışıyor: hesap ekleme, YouTube/TikTok bağlama, Yenile, gönderme, tekrar deneme, dosya yükleme.
- [ ] 390 px genişlikte yatay kaydırma yok; açık ve koyu modda metinler okunuyor.
- [ ] Durumlar renk + metinle ayırt ediliyor.
