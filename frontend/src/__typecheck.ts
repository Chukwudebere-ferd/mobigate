import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { EMPLOYMENT_CATEGORIES } from '@/types/domain'

const fileField = (message: string) =>
  z.custom<FileList>(
    (value) => {
      if (!value || typeof value !== 'object') return false
      const list = value as { length?: number }
      return typeof list.length === 'number' && list.length > 0
    },
    message,
  )

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  email: z.email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number')
    .regex(/^[\d+][\d\s-]{6,}$/, 'Enter a valid phone number'),
  gender: z.enum(['Male', 'Female', 'Other'], 'Select a gender'),
  employment_category: z.enum(EMPLOYMENT_CATEGORIES, {
    error: 'Select an employment category',
  }),
  id_document: fileField('Attach a copy of your identity document'),
  rules_of_engagement: z.boolean().refine(
    (accepted) => accepted,
    'You must accept the rules of engagement to continue',
  ),
})

type Values = z.infer<typeof schema>

export function useTest() {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      first_name: '',
      email: '',
      phone: '',
      gender: 'Female',
      employment_category: 'employee',
      rules_of_engagement: false,
    },
  })
  return form
}
