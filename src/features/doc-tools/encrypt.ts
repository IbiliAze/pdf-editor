/**
 * Password-protect the finished bytes.
 *
 * pdf-lib cannot encrypt, so a fork that can is loaded only when a password is
 * actually asked for: it is a large dependency and most exports never need it.
 */
export interface PasswordOptions {
  userPassword: string
  ownerPassword?: string
}

export async function encryptBytes(
  bytes: Uint8Array,
  password: PasswordOptions,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('@cantoo/pdf-lib')
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  doc.encrypt({
    userPassword: password.userPassword,
    ownerPassword: password.ownerPassword || password.userPassword,
    permissions: { printing: 'highResolution' },
  })
  return doc.save()
}
