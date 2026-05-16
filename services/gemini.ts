import { supabase } from './supabase';

export const sendMessageToAI = async (message: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('chat-with-ai', {
      body: { message },
    });

    if (error) {
      console.error("Supabase Edge Function Error:", error);
      return "Ներողություն, ինչ-որ սխալ տեղի ունեցավ: (Sorry, server error.)";
    }

    return data.reply || "Ներողություն, ոչինչ չեմ հասկանում: (No reply received.)";
  } catch (error) {
    console.error("AI Fetch Error:", error);
    return "Ներողություն, ինչ-որ սխալ տեղի ունեցավ: Խնդրում ենք փորձել կրկին: (Sorry, network error.)";
  }
};
