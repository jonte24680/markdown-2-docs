export class IndentedCodeBlock{
	static whitespaceRemove(text:string) {
		if(text[0] === "\t"){
			// 1 t
			return text.slice(1);
		} else {
			if(text[1] === "\t"){
				// 2 st
				return text.slice(2);
			} else if (text[2] === "\t") {
				// 3 sst
				return text.slice(3);
			} else {
				// 4 ssst ssss
				return text.slice(4);
			}
		}
	}
}
