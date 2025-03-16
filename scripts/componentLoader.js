class HTMLComponentLoader extends HTMLElement 
{
  constructor() 
  {
    super();
  }

  async connectedCallback() 
  {
    const src = this.getAttribute('src');
    if (src)
    {
        const response = await fetch(src);
        if (response.ok) 
        {
            const html = await response.text();
            this.innerHTML = html;
        } else 
        {
            console.error("Failed to load component:" + src);
        }
    } else 
    {
        console.error("No src attribute provided for component");
    }
  }
}

customElements.define('load-component', HTMLComponentLoader);

