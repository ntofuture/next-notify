# Mac Release Notları

Next Notify'ı GitHub'da imzalı ve noter onaylı bir release ile yayınlamak, ardından repoyu herkese açmak için Mac'te yapılacaklar. Adımları sırayla izleyin.

> Bu dosya iş bitince silinecek (son adım). Repo herkese açılacağı için anahtar, sertifika ya da parola **asla** depoya commit edilmez; hepsi GitHub Secrets'a girer.

## 0. Depoyu güncelleyin

```
cd ~/<proje klasörü>/next-notify
git pull
```

## 1. Şu anki Mac sürümü noter onaylı mı?

Kurulu uygulamada çalıştırın:

```
spctl -a -vvv "/Applications/Next Notify.app"
xcrun stapler validate "/Applications/Next Notify.app"
```

- `accepted` ve `source=Notarized Developer ID` görünüyorsa ve ikinci komut `The validate action worked!` diyorsa uygulama **noter onaylıdır**. 10. adımı yapın.
- Değilse ve storage'daki sürümü de imzalı yapmak isterseniz: `./deploy.sh` → `2` (Installer) → `3` (Upload). Mac'te Installer modu `private_keys/AuthKey_<key id>.p8` ve `private_keys/issuer` dosyalarını ister.

## 2. Sertifikayı `.p12` olarak dışa aktarın

GitHub'daki Mac derlemesi bu sertifikayla imzalanır. `.p8` dosyası yalnızca noter onayı içindir, imza için `.p12` gerekir.

1. Sertifikanın kurulu olduğunu kontrol edin:
   ```
   security find-identity -v -p codesigning
   ```
   Listede `Developer ID Application: …` satırı olmalı.
2. **Anahtar Zinciri Erişimi** → **Giriş** → **Sertifikalarım** → `Developer ID Application: …` → sağ tık → **Dışa Aktar**.
3. Biçim: **Kişisel Bilgi Değişimi (.p12)**. Masaüstüne `nextnotify.p12` adıyla kaydedin ve bir parola belirleyin. Parolayı bir sonraki adımda kullanacaksınız.

## 3. Secrets'ı GitHub'a ekleyin

GitHub CLI ile (kurulu değilse `brew install gh`, ardından `gh auth login`):

```
R=ntofuture/next-notify
KEY=$(ls private_keys/AuthKey_*.p8)

base64 -i ~/Desktop/nextnotify.p12 | tr -d '\n' | gh secret set CSC_LINK -R $R
gh secret set CSC_KEY_PASSWORD -R $R
base64 -i "$KEY" | tr -d '\n' | gh secret set APPLE_API_KEY_BASE64 -R $R
gh secret set APPLE_API_KEY_ID -R $R --body "$(basename "$KEY" .p8 | sed 's/^AuthKey_//')"
gh secret set APPLE_API_ISSUER -R $R --body "$(tr -d '[:space:]' < private_keys/issuer)"

gh secret list -R $R
```

`CSC_KEY_PASSWORD` satırı parolayı sorar; 2. adımda belirlediğiniz parolayı girin.

`gh secret list` şu beşini göstermeli: `APPLE_API_ISSUER`, `APPLE_API_KEY_BASE64`, `APPLE_API_KEY_ID`, `CSC_KEY_PASSWORD`, `CSC_LINK`.

Sonra `.p12` dosyasını silin: `rm ~/Desktop/nextnotify.p12`

Web arayüzünü tercih ederseniz: repo → **Settings → Secrets and variables → Actions → New repository secret**, aynı beş ad ve değer.

## 4. Actions ayarı

Repo → **Settings → Actions → General** → **Actions permissions**: "Allow all actions and reusable workflows" seçili olsun. Başka ayara gerek yok.

## 5. Workflow'u güncelleyin

`.github/workflows/release.yml` dosyasının içeriğini tamamen şununla değiştirin:

```yaml
name: Release

on:
  push:
    tags: ['v*']
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - run: npm ci
      - if: runner.os != 'macOS'
        run: npm run release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CSC_IDENTITY_AUTO_DISCOVERY: false
      - if: runner.os == 'macOS'
        run: |
          echo "$APPLE_API_KEY_BASE64" | base64 --decode > "$RUNNER_TEMP/AuthKey.p8"
          APPLE_API_KEY="$RUNNER_TEMP/AuthKey.p8" npm run release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLE_API_KEY_BASE64: ${{ secrets.APPLE_API_KEY_BASE64 }}
          APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
          APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}

  publish:
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - run: gh release edit "$GITHUB_REF_NAME" --repo "$GITHUB_REPOSITORY" --draft=false --latest
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Ne değişti:

- **Mac:** sertifika ve Apple anahtarı yalnızca Mac işine verilir. Uygulama imzalanır ve noter onayı alır.
- **Windows ve Linux:** eskisi gibi imzasız derlenir.
- **Yeni `publish` işi:** üç platform da başarılı olursa taslak release'i yayınlar ve "Latest" yapar.

README'deki release cümlesini de güncelleyin.

- `README.md` içinde:
  - eski: `which builds all three platforms and attaches the installers to a draft release.`
  - yeni: `which builds all three platforms, signs and notarizes the macOS app, and publishes the release once every installer is attached.`
- `README.tr.md` içinde:
  - eski: `üç platformun installer'larını derleyip taslak bir release'e ekler.`
  - yeni: `üç platformun installer'larını derler, macOS uygulamasını imzalayıp noter onayından geçirir ve tüm installer'lar eklenince release'i yayınlar.`

Commit edip gönderin:

```
git add .github/workflows/release.yml README.md README.tr.md
git commit -m "Sign and notarize the macOS build in CI and publish releases automatically"
git push
```

## 6. İlk release'i başlatın

Etiket `app/package.json` içindeki sürümle aynı olmalı (şu an `1.0.0`). Farklı olursa ayrı bir taslak oluşur.

```
git tag v1.0.0
git push origin v1.0.0
```

İlerlemeyi izleyin:

```
gh run watch -R ntofuture/next-notify
```

Ya da repo → **Actions** → **Release**. Noter onayı birkaç dakika sürebilir; toplamda 15–25 dakika bekleyin.

### Hata olursa

| Belirti | Sebep |
|---|---|
| `mac` işinde "MAC verification failed" ya da parola hatası | `CSC_KEY_PASSWORD` yanlış, ya da `CSC_LINK` başka bir `.p12` dosyası |
| "skipped macOS application code signing" | Sertifika `Developer ID Application` değil, ya da `CSC_LINK` boş |
| Noter onayında 401 / "Unable to authenticate" | `APPLE_API_KEY_ID` ya da `APPLE_API_ISSUER` yanlış, ya da anahtarın App Store Connect'te yetkisi yok |
| Releases'ta iki ayrı `v1.0.0` taslağı | İşler aynı anda release açmaya çalışmış. Boş olanı silin, `publish` işini yeniden çalıştırın |

Düzeltip baştan denemek için:

```
gh release delete v1.0.0 -R ntofuture/next-notify -y
git push --delete origin v1.0.0
git tag -d v1.0.0
```

Sonra 6. adımı tekrarlayın.

## 7. Release'i kontrol edin

```
gh release view v1.0.0 -R ntofuture/next-notify
```

Şu dosyalar olmalı:

- `NextNotify-Setup.exe` ve `.blockmap` dosyası
- `NextNotify-Setup.dmg`, `NextNotify-Setup.zip` ve bunların `.blockmap` dosyaları
- `Next-Notify-1.0.0-x86_64.AppImage`
- `Next-Notify-1.0.0-amd64.deb`
- `latest.yml`, `latest-mac.yml`, `latest-linux.yml`

GitHub'daki Mac uygulamasının noter onayını doğrulayın:

```
gh release download v1.0.0 -R ntofuture/next-notify -p 'NextNotify-Setup.zip' -D /tmp/nn
ditto -x -k /tmp/nn/NextNotify-Setup.zip /tmp/nn
spctl -a -vvv "/tmp/nn/Next Notify.app"
xcrun stapler validate "/tmp/nn/Next Notify.app"
```

`accepted`, `source=Notarized Developer ID` ve `The validate action worked!` görmelisiniz.

## 8. Repoyu herkese açın

```
gh repo edit ntofuture/next-notify --visibility public --accept-visibility-change-consequences
```

Ya da repo → **Settings → General → Danger Zone → Change repository visibility → Public**.

## 9. Açıldıktan sonra kontrol edin

- Gizli pencerede `https://github.com/ntofuture/next-notify/releases/latest` adresi açılıyor mu? Sitedeki "Tüm Platformlar İçin İndir" butonu buraya gider.
- Başka bir makinede Claude Code'da:
  ```
  /plugin marketplace add ntofuture/next-notify
  /plugin install next-notify@next-notify
  ```
  Yeni oturumda `/next-notify:test` bir bildirim göstermeli.
- Test makinelerinde eklentinin eski `2.0.0` sürümü kuruluysa kaldırıp yeniden kurun. Sürüm `1.0.0`'a çekildi.

## 10. Noter onaylıysa "henüz onaylanmadı" notlarını kaldırın

1. adımda ya da 7. adımda uygulama noter onaylı çıktıysa aşağıdaki metinleri güncelleyin.

### README

`README.md` içinde **Platform notes** bölümündeki macOS satırını değiştirin:

- eski: ``- **macOS:** the app isn't notarized yet. On first launch, right-click the app and choose **Open**, or run `xattr -cr "/Applications/Next Notify.app"`. macOS only installs updates for signed apps, so until then download new versions from Releases.``
- yeni: `- **macOS:** the app is signed and notarized by Apple, and updates install automatically like on Windows.`

`README.tr.md` içinde **Platform notları** bölümündeki macOS satırını değiştirin:

- eski: ``- **macOS:** uygulama henüz Apple tarafından onaylanmadı (notarization). İlk açılışta uygulamaya sağ tıklayıp **Aç**'ı seçin ya da `xattr -cr "/Applications/Next Notify.app"` komutunu çalıştırın. macOS yalnızca imzalı uygulamalara güncelleme kurar; o zamana kadar yeni sürümleri Releases sayfasından indirin.``
- yeni: `- **macOS:** uygulama Apple tarafından imzalanmış ve onaylanmıştır (notarization); güncellemeler Windows'taki gibi kendiliğinden kurulur.`

```
git add README.md README.tr.md
git commit -m "Note that the macOS app is notarized"
git push
```

### nextofuture.com sayfası

`https://panel.nextofuture.com` → **Geleceğin Merkezi → Next Notify** sayfası → **Kurulum** bölümü. Aşağıdaki iki metni değiştirip kaydedin, sonra aynısını İngilizce sayfada (**Future Zone → Next Notify → Installation**) yapın.

| Nerede | Eski | Yeni |
|---|---|---|
| TR · Adımlar · **Kurun** | Windows “bilgisayarınızı korudu” derse Ek bilgi › Yine de çalıştır'ı seçin; macOS'ta ilk açılışta uygulamaya sağ tıklayıp Aç'ı seçin. | Windows “bilgisayarınızı korudu” derse Ek bilgi › Yine de çalıştır'ı seçin; macOS'ta .dmg dosyasını açıp uygulamayı Uygulamalar klasörüne sürükleyin. |
| TR · Gereksinimler · **macOS** | macOS 12 ve sonrası; Intel ve Apple silicon. Uygulama henüz noter onaylı olmadığından yeni sürümleri şimdilik elle indirin. | macOS 12 ve sonrası; Intel ve Apple silicon. Apple tarafından imzalı ve onaylıdır; yeni sürümler kendiliğinden kurulur. |
| EN · Steps · **Install** | If Windows says it “protected your PC”, choose More info › Run anyway; on macOS, right-click the app and choose Open the first time. | If Windows says it “protected your PC”, choose More info › Run anyway; on macOS, open the .dmg and drag the app into Applications. |
| EN · Requirements · **macOS** | macOS 12 or later, Intel and Apple silicon. The app isn't notarized yet, so download new versions by hand for now. | macOS 12 or later, Intel and Apple silicon. Signed and notarized by Apple; new versions install on their own. |

Panelden kaydetmek önbelleği kendiliğinden temizler.

## 11. İsteğe bağlı: repo tanıtımı

Repo ana sayfası → **About** (⚙):

- **Description:** `Desktop notifications for Claude Code, Codex, Cursor, Gemini CLI and OpenCode`
- **Website:** `https://nextofuture.com/en/future-zone/next-notify`
- **Topics:** `claude-code`, `codex`, `cursor`, `gemini-cli`, `opencode`, `notifications`, `electron`, `desktop-app`

## 12. Bu dosyayı silin

```
git rm MAC-RELEASE-NOTES.md
git commit -m "Remove the release checklist"
git push
```

## Sonraki sürümler

1. `./deploy.sh` → `2` (Installer) ile yeni sürüm numarasını verin. Betik `app/package.json` dosyasını günceller.
2. `./deploy.sh` → `3` (Upload) ile storage'a yükleyin. Uygulamaların otomatik güncellemesi buradan okunur.
3. Sürümü commit edip etiketi gönderin. Örneğin 1.0.1 için:
   ```
   git commit -am "1.0.1"
   git push
   git tag v1.0.1
   git push origin v1.0.1
   ```
   GitHub release kendiliğinden oluşur ve yayınlanır.
