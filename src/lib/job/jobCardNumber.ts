export function getNextJobCardNumber(last: string | null): string {
    const prefix = "MP-";
  
    if (!last) return `${prefix}001A`;
  
    const match = last.match(/^MP-(\d{3})([A-Z])$/);
    if (!match) return `${prefix}001A`;
  
    let number = parseInt(match[1]);
    let letter = match[2];
  
    if (number < 999) {
      number += 1;
    } else {
      number = 1;
      letter = String.fromCharCode(letter.charCodeAt(0) + 1);
      if (letter > 'Z') letter = 'A'; // optional wrap
    }
  
    return `${prefix}${number.toString().padStart(3, '0')}${letter}`;
  }
  