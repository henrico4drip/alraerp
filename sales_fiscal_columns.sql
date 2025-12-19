ALTER TABLE sales
ADD COLUMN IF NOT EXISTS fiscal_status text, -- 'pending', 'authorized', 'error'
ADD COLUMN IF NOT EXISTS fiscal_doc_number text,
ADD COLUMN IF NOT EXISTS fiscal_doc_series text,
ADD COLUMN IF NOT EXISTS fiscal_doc_url text,
ADD COLUMN IF NOT EXISTS fiscal_doc_xml_url text;
