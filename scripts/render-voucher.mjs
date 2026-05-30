import { render } from '@react-email/components'
import React from 'react'
import { template } from '../src/lib/email-templates/gift-voucher.tsx'
import fs from 'fs'

const html = await render(
  React.createElement(template.component, {
    recipientName: 'Andresa',
    code: 'ANDRESA2205',
    amountCents: 2205,
    expiresAt: null,
  })
)
fs.writeFileSync('/mnt/documents/vale-presente-preview.html', html)
const subject = typeof template.subject === 'function' ? template.subject({ amountCents: 2205 }) : template.subject
console.log('SUBJECT:', subject)
