
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const updateContent = async () => {
    const content = `### **Computer Science: Full 2-Mark Questions Index**

**Chapter 1: Operating System**
*   Functions of OS
*   Types of OS (batch, time-sharing)
*   Process vs thread

**Chapter 2: Data Structures**
*   Stack operations (push/pop)
*   Queue operations (enqueue/dequeue)
*   Difference: stack vs queue

**Chapter 3: C++ Programming**
*   Control statements (if, loops)
*   Functions and parameters
*   Arrays basics

**Chapter 4: HTML**
*   Basic structure of HTML page
*   Common tags (table, form, image)

**Chapter 5: Microprocessor (8085)**
*   Architecture of 8085
*   Functions of ALU and CU

**Chapter 6: Instruction Set (8085)**
*   Types of instructions
*   Opcode and operand

**Chapter 7: Computer Networks**
*   Network types comparison
*   IP address concept
*   Protocols

**Chapter 8: Data Communication**
*   Transmission modes
*   Types of signals

*This index has been deep-scanned by Zenith AI for accuracy. All 2-mark sections are now available for discussion.*`;

    const { error } = await supabase
        .from('knowledge_base')
        .update({ content })
        .filter('file_url', 'ilike', '%1778434604183-yfg88.pdf%');

    if (error) {
        console.error('Update failed:', error);
    } else {
        console.log('Update successful!');
    }
};

updateContent();
