import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('ai')
export class AiController {

  @Post('improve-text')
  async improveText(@Body() body: { text: string; context?: string; type?: string }) {
    const { text, context, type } = body;

    const prompt = `Eres un asistente técnico de soporte informático de Grupo Gipfel. Mejora y redacta de forma profesional, clara y concisa el siguiente texto de un reporte de servicio técnico.

${type ? `Tipo de servicio: ${type}` : ''}
${context ? `Contexto del servicio: ${context}` : ''}
Texto original: ${text}

Responde SOLO con el texto mejorado, sin explicaciones adicionales, en español, máximo 3 oraciones.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [
          { role: 'system', content: 'Eres un asistente técnico profesional de soporte informático.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenAI error:', response.status, errBody);
      throw new Error(`OpenAI error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    return { improved: data.choices?.[0]?.message?.content || text };
  }
}
