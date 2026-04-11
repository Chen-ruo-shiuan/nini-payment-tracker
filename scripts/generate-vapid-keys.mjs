import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()
console.log('\n✅ VAPID Keys 產生成功！請複製以下內容到 .env.local 和 Railway 環境變數：\n')
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log(`NEXT_PUBLIC_VAPID_KEY=${keys.publicKey}`)
console.log('\n')
