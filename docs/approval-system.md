# Approval System

## States
- pending → approved | denied | expired | escalated

## Transitions
- pending → approved: owner confirms via WhatsApp/Telegram
- pending → denied: owner rejects via WhatsApp/Telegram
- pending → expired: timeout after 10 minutes
- pending → escalated: timeout after 2 minutes, escalate to deputy

## Timeout Rules
| Time | Action |
|------|--------|
| T+0 | Send to owner (primary: Telegram) |
| T+2min | Reminder on secondary channel (WhatsApp) |
| T+5min | Escalate to deputy approver |
| T+10min | Mark expired, notify owner, do not execute |
| T+30min | Page owner via SMS if time-sensitive |

## Smart Defaults
| Action | Condition | Decision |
|--------|-----------|----------|
| vercel.deploy | preview | auto-approve |
| email.send | recipients < 10 | auto-approve |
| vercel.deploy | production | require-approval |
| github.push | main | require-approval |
| payment.send | any | require-approval |
| secret.access | any | require-approval |
| content.create | any | auto-approve |
| ticket.resolve | any | auto-approve |
| analytics.view | any | auto-approve |
| report.generate | any | auto-approve |
