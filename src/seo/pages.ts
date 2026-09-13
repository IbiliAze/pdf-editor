/**
 * The pages a search engine can land on. Each one is the same editor with its
 * own title, copy and questions, so the site ranks for the task someone
 * searched for rather than only for "pdf editor". `src/seo/plugin.ts` turns
 * these into HTML at build time; nothing here is shipped to the browser.
 */
export const SITE = 'https://pdf-editor.eightmile.co.uk'

export interface Faq {
  q: string
  a: string
}

export interface PageDef {
  /** URL path, "/" for the home page */
  path: string
  /** the stub HTML file in the repo root that Vite builds */
  file: string
  title: string
  description: string
  h1: string
  intro: string
  /** tool selected when the editor opens, from the feature registry */
  tool?: string
  /** heading of the empty state, in place of "Open a PDF to start editing" */
  heading?: string
  /** the short label used when other pages link here */
  label: string
  steps?: string[]
  faq: Faq[]
}

const PRIVACY: Faq = {
  q: 'Is my PDF uploaded?',
  a: 'No. The file is opened, edited and written by code running in your browser. Nothing about the document reaches our server: no bytes, no text, no form values. Only your email address, your news preference and a record of each download are stored, and you can delete the account whenever you like.',
}

const FREE: Faq = {
  q: 'Is it really free?',
  a: 'Yes. There are no paid tiers, no watermarks and no page limits. Downloading needs a free account with a confirmed email address, which is how the tool pays for itself: it introduces people to Eight Mile, the studio that built it.',
}

const FEATURES = [
  'Edit text in the original font, on the original baseline',
  'Fill forms, keep them fillable or flatten them',
  'Sign by drawing, typing or uploading a photo',
  'Redact so the content is gone from the file',
  'Reorder, rotate, insert, extract and split pages',
  'Merge PDFs, add watermarks, page numbers and passwords',
]

export const PAGES: PageDef[] = [
  {
    path: '/',
    file: 'index.html',
    label: 'PDF editor',
    title: 'Eight Mile PDF – free PDF editor that runs in your browser',
    description:
      'Edit text, fill forms, sign, redact, reorder pages and merge PDFs in your browser. Nothing is uploaded. Free, from Eight Mile.',
    h1: 'A free PDF editor that never uploads your file',
    intro:
      'Open a PDF and edit it here, in your browser. The file stays on your computer from start to finish: nothing is sent to a server, so there is nothing to be leaked, kept or read. Edit text, fill and sign forms, redact, rearrange pages and merge documents, then download the result.',
    steps: FEATURES,
    faq: [
      PRIVACY,
      FREE,
      {
        q: 'Can I edit the existing text, not just add text on top?',
        a: 'Yes. Click any line and rewrite it. The replacement is drawn in the typeface the document embedded whenever that font can render it, on the same baseline and at the same angle, so an edit is usually indistinguishable from the original. Switch to Edit paragraph to rewrite a whole block; it re-wraps inside the original column.',
      },
      {
        q: 'Does it work on a phone or tablet?',
        a: 'Yes. It is a web page, so it runs in Safari, Chrome, Firefox and Edge on desktop and mobile. Nothing is installed.',
      },
      {
        q: 'Can I open a password-protected PDF?',
        a: 'Yes. Enter the password when asked. It is used in your browser to decrypt the file and is never sent anywhere. You can also set a password on the file you download.',
      },
      {
        q: 'Who makes this?',
        a: 'Eight Mile, a studio that designs websites and builds web apps and SaaS products for businesses. The editor is free because it is how people find us.',
      },
    ],
  },
  {
    path: '/edit-pdf-text',
    file: 'edit-pdf-text.html',
    label: 'Edit PDF text',
    tool: 'edittext',
    heading: 'Open a PDF to edit its text',
    title: 'Edit text in a PDF online, free and without uploading it',
    description:
      'Click any line in a PDF and rewrite it in the original font. Runs in your browser, nothing is uploaded. Free, no watermark.',
    h1: 'Edit the text in a PDF, in the original font',
    intro:
      'Most free tools let you paste a text box over a PDF. This one rewrites the line itself: click it, type, and the replacement is drawn with the font the document already uses, on the same baseline, at the same size and angle. Change a date, a name or a price and the page looks untouched.',
    steps: [
      'Open the PDF. Click here or drop the file onto the page.',
      'Click the line you want to change and type. Click into the middle of a line to change a single word.',
      'Choose Edit paragraph to rewrite a whole block; it re-wraps inside the original column width.',
      'Download PDF. The file is written in your browser.',
    ],
    faq: [
      {
        q: 'Will the new text match the original font?',
        a: 'When the document embeds the font and that font can render what you typed, yes: the editor reuses it. Otherwise it falls back to a bundled family chosen to match, such as Arimo for Arial and Helvetica or Tinos for Times, with the same character widths so the line keeps its length.',
      },
      {
        q: 'Is the old text still in the file?',
        a: 'Yes. A text edit covers the old run and draws the new one, which is how every PDF editor works without rebuilding the page. If the old text must be gone for good, use Redact, which removes it from the file.',
      },
      {
        q: 'Can I edit rotated or very small text?',
        a: 'Yes. Rotated, angled and small runs are all editable, and the replacement keeps the original angle.',
      },
      PRIVACY,
      FREE,
    ],
  },
  {
    path: '/fill-pdf-form',
    file: 'fill-pdf-form.html',
    label: 'Fill a PDF form',
    heading: 'Open a PDF form to fill it in',
    title: 'Fill in a PDF form online, free, and keep it fillable',
    description:
      'Fillable fields become real inputs. Type, tick, choose, then download a form that is still fillable or flattened. Nothing is uploaded.',
    h1: 'Fill in a PDF form without printing it',
    intro:
      'Open the form and its fields are detected and turned into real inputs: text boxes, tick boxes, radio buttons and drop-downs. Fill them in, sign if you need to, and download. The result keeps the document’s own form, so whoever receives it can still edit the fields, or you can flatten it so they cannot.',
    steps: [
      'Open the form. Fields appear as inputs over the page.',
      'Type into the fields, tick the boxes and pick from the drop-downs.',
      'Add a signature with Sign if the form asks for one.',
      'Download PDF. Tick Flatten forms in the download dialog to lock the answers in.',
    ],
    faq: [
      {
        q: 'What if the form has no fillable fields?',
        a: 'Use Add text to place a text box wherever an answer goes, and Sign for the signature line. Scanned forms work the same way.',
      },
      {
        q: 'What does flattening do?',
        a: 'It paints the answers onto the page and removes the fields, so the form can no longer be edited. Leave the box unticked to keep the fields live.',
      },
      {
        q: 'Are my answers uploaded?',
        a: 'No. Form values are part of the document and stay in your browser like everything else in the file.',
      },
      FREE,
    ],
  },
  {
    path: '/sign-pdf',
    file: 'sign-pdf.html',
    label: 'Sign a PDF',
    tool: 'signature',
    heading: 'Open a PDF to sign it',
    title: 'Sign a PDF online for free: draw, type or upload your signature',
    description:
      'Place a drawn, typed or photographed signature on any PDF in your browser. Nothing is uploaded, no account with a signing service needed.',
    h1: 'Sign a PDF without a signing service',
    intro:
      'Click where the signature goes, then draw it with a mouse or finger, type it in a script face, or upload a photo of your signature on paper and the background is removed. Signatures are remembered in your browser for next time. The file never leaves your computer.',
    steps: [
      'Open the PDF and choose Sign.',
      'Click where the signature belongs.',
      'Draw it, type it, or upload a photo. Drag the corners to size it.',
      'Download PDF.',
    ],
    faq: [
      {
        q: 'Is this a legally binding e-signature?',
        a: 'It places an image of your signature on the document, the same as signing a printed copy and scanning it. It does not add a cryptographic certificate or an audit trail. For contracts that require a certified signature, use a signing service.',
      },
      {
        q: 'Can I sign on my phone?',
        a: 'Yes. Drawing with a finger works well on a touch screen.',
      },
      {
        q: 'Where is my signature stored?',
        a: 'In your browser only, so it can be reused. It is never sent to us.',
      },
      PRIVACY,
      FREE,
    ],
  },
  {
    path: '/redact-pdf',
    file: 'redact-pdf.html',
    label: 'Redact a PDF',
    tool: 'redact',
    heading: 'Open a PDF to redact it',
    title: 'Redact a PDF properly, free and in your browser',
    description:
      'True redaction: the marked content is removed from the file, not hidden under a box. Find and redact every match at once. Nothing is uploaded.',
    h1: 'Redact a PDF so the content is actually gone',
    intro:
      'Drawing a black box over text hides it on screen and leaves it in the file, where it can still be selected, searched and copied. Redact here removes it: the page is rendered to an image with the marked areas painted out and written as a new page, so the content is not in the document at all. Find lets you redact every occurrence of a name or number in one go.',
    steps: [
      'Open the PDF and choose Redact.',
      'Drag over what must go. Use Find to mark every match of a word at once.',
      'Download PDF. Redacted pages are rebuilt without the content.',
      'Check the download: the redacted words are gone from search and copy.',
    ],
    faq: [
      {
        q: 'How is this different from a black rectangle?',
        a: 'A rectangle sits on top of the content, which stays in the file. Redaction renders the page without it. After redacting, the text cannot be found by search, copied or recovered by removing a layer.',
      },
      {
        q: 'What is the catch?',
        a: 'A redacted page becomes an image, so its remaining text is no longer selectable. Pages you do not redact are untouched.',
      },
      {
        q: 'Is the redacted document sent anywhere?',
        a: 'No. Redaction happens in your browser, which is the point: a document that needs redacting is exactly the document you should not upload.',
      },
      FREE,
    ],
  },
  {
    path: '/merge-pdf',
    file: 'merge-pdf.html',
    label: 'Merge PDFs',
    heading: 'Open the first PDF to merge',
    title: 'Merge PDFs online for free, without uploading them',
    description:
      'Combine PDFs, reorder pages by dragging, rotate, delete, extract and split. Runs in your browser, nothing is uploaded.',
    h1: 'Merge PDFs and put the pages in order',
    intro:
      'Open the first file, insert the others where they belong, then drag the thumbnails into the order you want. Rotate, duplicate or delete pages, extract a selection as its own file, or split by page ranges. Everything happens in your browser.',
    steps: [
      'Open the first PDF, then open Pages.',
      'Choose Insert PDF… to add another file at the selected page.',
      'Drag thumbnails to reorder. Rotate, duplicate or delete as needed.',
      'Download PDF, or use Extract and Split… for separate files.',
    ],
    faq: [
      {
        q: 'Is there a limit on file size or page count?',
        a: 'Only what your browser can hold in memory. Documents of a few hundred pages are fine on an ordinary laptop.',
      },
      {
        q: 'Do forms and bookmarks survive a merge?',
        a: 'Fillable fields are carried across. Bookmarks and metadata from the inserted files are not kept.',
      },
      {
        q: 'Can I split one PDF into several?',
        a: 'Yes. Split… takes page ranges and downloads each as its own file. Extract downloads the selected pages as one file.',
      },
      PRIVACY,
      FREE,
    ],
  },
]

export const pageByFile = (file: string): PageDef | undefined => PAGES.find((p) => p.file === file)
export const pageByPath = (path: string): PageDef | undefined => PAGES.find((p) => p.path === path)
