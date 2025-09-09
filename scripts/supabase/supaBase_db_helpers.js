import { Start } from '../tournaments/tournament_data.js';

function OutputResponse(response) 
{
    if (response.error) 
    {
        console.error('Error:', response.error);
    } else 
    {
        console.log('Success:', response.data);
    }
}

export async function DB_Update(tbl, data, id) 
{
    const response = await supabase
    .from(tbl)
    .update(data)
    .eq('id', id)
    .select();

    OutputResponse(response);
    return response;
}

export async function DB_Delete(tbl, id) 
{
    const response = await supabase
    .from(tbl)
    .delete()
    .eq('id', id)
    .select();

    OutputResponse(response);
    if (!response.error)
    {
        Start();
    }
    return response;
}

export async function DB_Insert(tbl, data) 
{
    const response = await supabase
    .from(tbl)
    .insert(data)
    .select();

    OutputResponse(response);
    if (!response.error)
    {
        Start();
    }
    return response;
}
