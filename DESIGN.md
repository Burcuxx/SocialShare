# Social Share — Tasarım Spesifikasyonu

Bu dosya Claude Code için yazıldı. Kullanmak için Claude Code'a şunu yaz:

> `DESIGN.md` dosyasındaki tasarımı uygula. Mevcut işlevselliği (server action'lar, upload, worker, OAuth ve auth mantığı) değiştirme; arayüzü, stilleri ve çeviri altyapısını ekle. Yeni npm bağımlılığı ekleme.

Görsel referans (canvas): https://claude.ai/artifact/Hc7ghpqtWdpJprp9VnUQSY
Canvas'taki ekranlar: Logo ve favicon · Giriş yap · Kayıt ol · Hesap / Yeni video · Hesap / Video listesi · Gönderi detayı · Mobil yeni video · Mobil video listesi.

---

## 1. Genel kurallar

- `src/lib/db.ts`, `jobs.ts`, `worker.ts`, `youtube.ts`, `tiktok.ts`, `files.ts` ve `src/app/api/**` dokunulmaz. Login/register'ın auth mantığı da dokunulmaz; sadece görünümü bu dosyaya uyar.
- Tailwind veya UI kütüphanesi yok; düz CSS + CSS değişkenleri (`globals.css`).
- İkonlar inline SVG (stroke 2 px, `currentColor`). Emoji kullanma.
- Erişilebilirlik: gerçek `<button>`, `<a>`, `<label>`; ikon-only butonlarda `aria-label`; aktif menüde `aria-current="page"`; metin kontrastı ≥ 4.5:1; dokunma hedefleri ≥ 44 px.
- Kullanıcıya görünen **her metin** çeviri sözlüğünden gelir (bkz. §4). Bileşenlerde sabit Türkçe metin kalmaz.

## 2. Marka: logo ve favicon

Dosyalar repoda hazır:

| Dosya | Ne için |
|---|---|
| `src/app/icon.svg` | Favicon. Next.js otomatik `<link rel="icon">` ekler. |
| `src/app/apple-icon.png` | 180×180 iOS ana ekran ikonu. Next.js otomatik ekler. |
| `public/logo-mark.svg` | Lime zemin, koyu sembol. Koyu yüzeylerde (sidebar, mobil üst çubuk, auth paneli) kullanılır. |
| `public/logo-mark-dark.svg` | Koyu zemin, lime sembol. Açık yüzeylerde kullanılır. |

Fikir: soldaki nokta tek yüklenen video, ondan çıkan üç kol YouTube, TikTok ve Instagram ("Bir yükle, her yere gönder").

`src/components/logo.tsx` oluştur: sembolü inline SVG olarak çizen ve yanına "Social Share" yazan bir bileşen. Props: `size` (varsayılan 32), `variant: "onDark" | "onLight"`, `showText` (varsayılan true). Wordmark: Bricolage Grotesque 700, `letter-spacing: -0.01em`. Sidebar'da 32 px, mobil üst çubukta 28 px, auth panelinde 32 px kullanılır. `layout.tsx` içindeki `metadata`'ya `applicationName: "Social Share"` ve `themeColor: "#17181C"` (viewport'a) ekle.

## 3. Tasarım token'ları

### Tipografi (`next/font/google`, `layout.tsx`)

| Rol | Font | Kullanım |
|---|---|---|
| Başlık | **Bricolage Grotesque** 600/700 | h1 40 px (≤720 px: 30 px), h2 22 px, auth başlıkları 36 px, logo |
| Gövde | **Geist** 400/500/600 | her şey; input'larda en az 16 px (iOS zoom yapmasın) |
| Rakam | **Geist Mono** 500 | süre, sayaçlar (24 / 100), yüzdeler, sekme sayıları |

### Renkler (`globals.css`)

```css
:root {
  --ground: #F2F3EF;      /* sayfa zemini */
  --surface: #FFFFFF;     /* kartlar */
  --surface-2: #FAFAF8;   /* textarea, dropzone */
  --segment: #E6E7E2;     /* sekme grubu zemini */
  --ink: #17181C;         /* ana metin, sidebar zemini */
  --ink-2: #4A4D55;       /* ikincil metin */
  --line: #E2E3DE;
  --line-strong: #DADBD5;
  --primary: #4338CA;     /* ana buton, seçili kart kenarı, progress */
  --primary-ink: #3730A3; /* linkler */
  --highlight: #C8F169;   /* logo zemini, aktif dil, koyu yüzeydeki vurgu */
  --warn: #92400E;        /* "Özel / Sadece ben" uyarıları */

  --done-bg: #DCFCE7;    --done-fg: #166534;
  --failed-bg: #FEE2E2;  --failed-fg: #991B1B;
  --run-bg: #E0E7FF;     --run-fg: #3730A3;
  --wait-bg: #EDEEEA;    --wait-fg: #3F4249;

  --youtube: #DC2626;
  --tiktok: #17181C;
  --instagram: #A21CAF;
}
```

Koyu mod (`prefers-color-scheme: dark`): ground `#111214`, surface `#1A1B1F`, surface-2 `#202126`, segment `#26282E`, ink `#F1F2EE`, ink-2 `#A9ABA4`, line `#2C2E34`, line-strong `#3A3D45`, primary `#6366F1`, primary-ink `#A5B4FC`. Sidebar her iki modda da `#17181C` / `#0B0C0E`.

Radius: kart 14–16 px, buton/input 10 px, sekme grubu 12 px, çip 999 px. Gölge yok.

## 4. Çoklu dil (i18n)

Başlangıç dilleri **Türkçe (`tr`, varsayılan)** ve **İngilizce (`en`)**. Yeni dil eklemek sadece yeni bir sözlük dosyası eklemek olmalı. Kütüphane kullanma.

**Yapı:**

```
src/i18n/
  tr.ts        // export const tr = { nav: {...}, newPost: {...}, status: {...}, ... } as const
  en.ts        // export const en: Dict = {...}  (tr ile aynı anahtarlar; TypeScript eksik anahtarı yakalar)
  index.ts     // LOCALES = ["tr","en"] as const; type Locale; type Dict = typeof tr; getDict(locale)
  server.ts    // getLocale(): cookie "lang" → yoksa Accept-Language → yoksa "tr"; getT()
  client.tsx   // <I18nProvider dict locale> + useT() hook (client component'ler için)
```

- `layout.tsx`: `getLocale()` ile `<html lang={locale}>`; sözlüğü `I18nProvider` ile client'a geçir.
- `setLocale(locale)` server action'ı `actions.ts`'e eklenir: `lang` cookie'sini 1 yıllık yazar, `revalidatePath("/", "layout")`.
- `src/lib/labels.ts` içindeki `STATUS_LABELS` sözlüğe taşınır (`t.status.pending` …). `PLATFORM_NAMES` özel isim olduğu için kalır.
- Server action'lardaki kullanıcıya görünen hata metinleri (ör. "Video veya başlık eksik") de sözlükten gelir.
- Tarih/saat: `toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { dateStyle: "medium", timeStyle: "short" })`. Bugün/dün için `Intl.RelativeTimeFormat` kullan ("Bugün 14:32" / "Today 2:32 PM").
- Çoğullar: `Intl.PluralRules` ile; ör. `t.send.button(count)` → "Gönder · 2 platform" / "Send · 2 platforms".
- Metin uzunluğu dile göre değişir: hiçbir buton veya sekme sabit genişlikte olmasın; uzun metinde satır kırılsın ya da `text-overflow: ellipsis` kullanılsın.

**Dil seçici:**
- Masaüstü: sidebar'ın en altında "Dil / Language" etiketi ve iki seçenekli segment (`role="radiogroup"`; seçili olan `highlight` zemin, koyu yazı).
- Mobil: üst çubukta 44 px'lik "TR" / "EN" butonu, basınca küçük bir menü açılır.
- Auth sayfaları: sol koyu panelin altında aynı segment. Mobilde form başlığının üstünde.
- Kayıt formunda opsiyonel "Arayüz dili" `<select>`'i (auth mantığı destekliyorsa kullanıcıya kaydedilir, yoksa sadece cookie'yi yazar).

## 5. Responsive davranış

Mobile-first yaz. Kırılma noktaları:

| Genişlik | Düzen |
|---|---|
| **≤ 720 px** (telefon) | Sidebar gizlenir; yerine koyu **üst çubuk**: logo (28 px) + dil butonu + hesap seçici butonu (açılınca hesap listesi ve "Yeni hesap" formu açılır menüde). İçerik padding'i 16 px, h1 30 px. Sekmeler tam genişlik. Kartlar tek kolon. Ana buton tam genişlikte ve ekranın altına sabit (`position: sticky; bottom: 0`, `padding-bottom: max(16px, env(safe-area-inset-bottom))`). |
| **721–1000 px** (tablet) | Sidebar 248 px görünür; içerik tek kolon (form üstte, platform seçimi altta). |
| **> 1000 px** (masaüstü) | Sidebar + iki kolonlu içerik (`7fr / 5fr` yeni video, `5fr / 7fr` gönderi detayı). İçerik `max-width: 1200px`. |
| Auth **≤ 860 px** | Sol koyu panel gizlenir; logo formun üstüne gelir. |

Kontrol listesi: 360 px'te yatay kaydırma yok · tablo satırları ≤ 900 px'te karta dönüşür · görseller `max-width: 100%` · uzun dosya adları ve hata mesajları `word-break: break-word`.

## 6. Bileşenler

- **Buton (ikincil):** 44 px yükseklik, `surface` zemin, `line-strong` kenar, 500 ağırlık.
- **Buton (ana):** `primary` zemin, beyaz yazı, 52 px, 600 ağırlık, sağda ok ikonu. Disabled/yükleniyor durumunda metin "Yükleniyor %62" olur ve butonun üstünde 6 px progress bar görünür.
- **Sekme grubu (Yeni video | Videolar · 12):** `segment` zeminli kapsül, aktif sekme `surface` zemin + 600 ağırlık. Gerçek `<a>`'lar, aktif olanda `aria-current="page"`.
- **Filtre çipleri:** 40 px yüksek kapsül, aktif = `ink` zemin beyaz yazı. Mobilde yatay kaydırılabilir satır.
- **Durum çipi** (`.badge.<status>`): `pending` → wait, `downloading`/`processing`/`uploading` → run, `done` → done ("✓ YouTube"), `failed` → failed ("Hata · TikTok"). Renk tek başına anlam taşımaz; metin her zaman platform + durumu söyler.
- **Platform işareti:** 32–36 px kare, 9–10 px radius, platform renginde zemin, beyaz iki harf (Yt, Tk, Ig). Bağlı olmayan platform: gri zemin, kesik kenarlı kart.
- **Karakter sayacı:** etiketin sağında Geist Mono "24 / 100". Sınıra %90 yaklaşınca `warn`, aşınca `failed-fg` rengi.

## 7. Ekranlar

### 7.1 Sidebar (`src/components/sidebar.tsx`)
Koyu (`ink`) zemin. Üstte `<Logo variant="onDark" />`. "Hesaplar" başlığı, her hesap için 44 px'lik satır (solda 28 px'lik baş harf kutusu; aktif olanda `highlight` zemin, satır `#26282E`). Altında "Yeni hesap" input'u ve 44 px "+" butonu (mevcut `createAccount`). En altta dil seçici. Login varsa en altta kullanıcı adı + "Çıkış yap" linki. ≤720 px'te §5'teki üst çubuğa dönüşür (mevcut `menu-button` / `open` mantığı korunur).

### 7.2 Hesap sayfası — Yeni video (`src/app/accounts/[id]/page.tsx` + `new-post-form.tsx`)
- Başlık satırı: hesap adı (h1) + sağda sekme grubu "Yeni video | Videolar · N". Videolar sekmesi için `/accounts/[id]/videos` route'u ekle; mevcut "Gönderilenler" listesi oraya taşınır.
- **Bağlantı şeridi** (beyaz kart): "Bağlı:" + platform çipleri (işaret + display_name), sağda "+ YouTube", "+ TikTok" ikincil linkleri.
- **Sol kolon, form kartı:** h2 "Yeni video" · **dropzone** (180 px yükseklik, kesik kenar, ortada yükleme ikonu, "Videoyu sürükle ya da seç", "MP4, MOV veya WebM"; sürükle-bırak desteklenir, gizli `input[type=file]`'a bağlanır) · dosya seçilince dropzone yerine **dosya satırı** (küçük önizleme kutusu, dosya adı, Geist Mono "0:58 · 48 MB", 44 px "Dosyayı kaldır" butonu) · Başlık input'u (sayaç /100) · Açıklama textarea (sayaç /2000).
- **Sağ kolon, "Nereye gönderilsin?":** her bağlantı için seçilebilir kart (`<label>` + checkbox sağda; seçiliyken 2 px `primary` kenar). Kartta platform işareti, ad, display_name ve platform notu (`warn` rengiyle): YouTube "Google onaylayana kadar Özel yüklenir", TikTok "TikTok onaylayana kadar Sadece ben paylaşılır". Bağlı olmayan platformlar gri, kesik kenarlı "Bağlı değil" kartı. Altında bilgi: "TikTok ve Instagram'da başlık ve açıklama tek metin olarak birleştirilir (en fazla 2200 karakter)." En altta ana buton "Gönder · N platform" ve yükleme ilerlemesi.
- Hiç bağlantı yoksa sağ kolonda boş durum: "Önce bir platform bağla" + bağlama butonları.

### 7.3 Video listesi (`/accounts/[id]/videos`)
- Aynı başlık + sekme grubu (Videolar aktif).
- Filtre çipleri: Tümü · N, İşleniyor · N, Tamamlandı · N, Hata · N (`?status=` query param; sayılar `jobs`'tan hesaplanır: herhangi bir iş failed → Hata, hepsi done → Tamamlandı, aksi halde İşleniyor). Sağda başlıkta arama (`?q=`, SQL `LIKE`).
- Liste kartı içinde satırlar: 72 px 16:9 önizleme kutusu (+ süre), başlık + açıklamanın ilk satırı (tek satır, ellipsis), tarih, platform durum çipleri, sağ ok. Masaüstünde tablo başlıkları (Video · Tarih · Platformlar). ≤900 px'te satır karta dönüşür, tarih ve çipler başlığın altına iner.
- Sayfalama: 20'şer, altta "Daha fazla göster" butonu (`?limit=`).
- Boş durum: "Henüz video yok" + "Yeni video" sekmesine link.

### 7.4 Gönderi detayı (`src/app/posts/[id]/page.tsx`)
- Üstte "← Videolar" linki (hesabın video listesine).
- **Sol kolon:** 16:9 önizleme (16 px radius, süre etiketi), h1 başlık, meta satırı (hesap · tarih · süre), açıklama (`white-space: pre-line`).
- **Sağ kolon:** "Platformlar" + sağda "1 / 3 tamamlandı". Her iş için kart:
  - İşleniyor: 2 px `primary` kenar, 3 adımlı progress (Sırada → Yükleniyor → Gönderildi; bitenler yeşil ✓, aktif `primary`, bekleyen gri), altında "Sayfa otomatik yenileniyor…" (mevcut `AutoRefresh`).
  - Bitti: done çipi, `surface-2` zeminli not (mevcut `doneNote` metinleri, çevrilmiş), YouTube için "Videoyu aç ↗" ve "YouTube Studio ↗" ikincil linkleri.
  - Hata: failed çipi + deneme sayısı ("Hata · 3 deneme"), `#FEF2F2` zeminli hata kutusu, "Tekrar dene" ikincil butonu (mevcut `retry`).

### 7.5 Giriş yap / Kayıt ol (`/login`, `/register`)
Auth mantığını değiştirme; sadece görünüm:
- İki kolon: solda koyu panel (logo, büyük slogan "Bir kez yükle. Her yere gönder.", kısa açıklama, platform çipleri, en altta dil seçici). Kayıt sayfasında slogan yerine 3 adım (Hesabını oluştur → Platformları bağla → İlk videonu gönder). Sağda ortalanmış form (`max-width: 400px`).
- Form: h1, altında diğer sayfaya link ("Hesabın yok mu? Kayıt ol"). Alanlar 48 px yükseklik, `autocomplete` değerleri doğru (`email`, `current-password`, `new-password`, `name`). Girişte "Şifremi unuttum" linki ve "Beni hatırla" checkbox'ı (auth destekliyorsa). Kayıtta 4 parçalı şifre gücü göstergesi + ipucu.
- Hata: formun üstünde `role="alert"` kutusu (`#FEF2F2` zemin, `failed-fg` yazı). Alan hatası: input kenarı `failed-fg` + altında mesaj, `aria-describedby` ile bağlı.
- Ana buton tam genişlik, 52 px. Gönderilirken disabled + "Giriş yapılıyor…".
- Auth sayfaları sidebar'sız layout kullanır (route group: `src/app/(auth)/layout.tsx`, uygulama sayfaları `src/app/(app)/layout.tsx`).

## 8. Kabul kriterleri

- [ ] `npm run typecheck` ve `npm run build` geçiyor.
- [ ] Mevcut akışlar çalışıyor: hesap ekleme, YouTube/TikTok bağlama, video yükleme + gönderme, tekrar deneme, login/register.
- [ ] Dil değiştirince tüm arayüz (durumlar, hata mesajları ve tarihler dahil) seçilen dilde; tercih sayfa yenilense de kalıyor; `<html lang>` doğru.
- [ ] `en.ts`'de eksik anahtar varsa typecheck hata veriyor.
- [ ] 360, 390, 768, 1024 ve 1440 px'te yatay kaydırma yok; telefonda sidebar üst çubuğa dönüşüyor ve gönder butonu altta sabit.
- [ ] Favicon ve iOS ikonu görünüyor; logo sidebar'da, mobil üst çubukta ve auth sayfalarında var.
- [ ] Açık ve koyu modda metinler okunuyor; durumlar renk + metinle ayırt ediliyor.
